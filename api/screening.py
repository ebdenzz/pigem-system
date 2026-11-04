import base64

import os

import re

import threading

import time

from concurrent.futures import ThreadPoolExecutor

from datetime import datetime, timezone

from typing import Any, Dict, List, Optional

import httpx

import ai

import mailer

import ocr

import quality

def _iso_now() -> str:

    return datetime.now(timezone.utc).isoformat()

class BaseCloudGateway:

    def fetch_application(self, app_id: str) -> Optional[Dict[str, Any]]:

        raise NotImplementedError("Subclasses must implement fetch_application().")

    def update_application(self, app_id: str, payload: Dict[str, Any]) -> bool:

        raise NotImplementedError("Subclasses must implement update_application().")

    def download_id_bytes(self, path_or_url: str) -> Optional[bytes]:

        raise NotImplementedError("Subclasses must implement download_id_bytes().")

class SupabaseApplicationGateway(BaseCloudGateway):

    _DATA_URL_REGEX = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,(.+)$", re.DOTALL)

    _SAFE_REF_REGEX = re.compile(r"[^A-Za-z0-9_-]")

    def _credentials(self) -> tuple:

        url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")

        key = (os.getenv("SUPABASE_ANON_KEY") or "").strip()

        return url, key

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:

        _, key = self._credentials()

        headers = {

            "apikey": key,

            "Authorization": "Bearer " + key,

        }

        if extra:

            headers.update(extra)

        return headers

    def is_screening_enabled(self) -> bool:

        url, key = self._credentials()

        if not url or not key:

            return True

        try:

            res = httpx.get(

                url + "/rest/v1/system_settings",

                params={"id": "eq.main", "select": "ai_enabled"},

                headers=self._headers(),

                timeout=8,

            )

            if res.status_code == 200:

                rows = res.json()

                if rows and rows[0].get("ai_enabled") is False:

                    return False

        except Exception:

            pass

        return True

    def fetch_application(self, app_id: str) -> Optional[Dict[str, Any]]:

        url, key = self._credentials()

        if not url or not key:

            return None

        try:

            res = httpx.get(

                url + "/rest/v1/applications",

                params={"id": "eq." + app_id, "select": "*"},

                headers=self._headers(),

                timeout=12,

            )

            if res.status_code == 200:

                rows = res.json()

                if rows:

                    return rows[0]

        except Exception as err:

            print("[screening] fetch application error:", err)

        return None

    def update_application(self, app_id: str, payload: Dict[str, Any]) -> bool:

        url, key = self._credentials()

        if not url or not key:

            return False

        body = dict(payload)

        body["updated_at"] = _iso_now()

        try:

            res = httpx.patch(

                url + "/rest/v1/applications",

                params={"id": "eq." + app_id},

                headers=self._headers({"Content-Type": "application/json", "Prefer": "return=minimal"}),

                json=body,

                timeout=15,

            )

            return res.status_code in (200, 204)

        except Exception as err:

            print("[screening] update application error:", err)

            return False

    def download_id_bytes(self, path_or_url: str) -> Optional[bytes]:

        if not path_or_url:

            return None

        raw = str(path_or_url).strip()

        data_match = self._DATA_URL_REGEX.match(raw)

        if data_match:

            try:

                return base64.b64decode(data_match.group(1))

            except Exception:

                return None

        url, key = self._credentials()

        if raw.startswith("http://") or raw.startswith("https://"):

            try:

                headers = self._headers() if (url and raw.startswith(url)) else {}

                res = httpx.get(raw, headers=headers, timeout=20, follow_redirects=True)

                if res.status_code == 200 and res.content:

                    return res.content

            except Exception as err:

                print("[screening] download URL error:", err)

            return None

        if url and key:

            clean_rel = raw.lstrip("/")

            for candidate in (

                url + "/storage/v1/object/public/documents/" + clean_rel,

                url + "/storage/v1/object/authenticated/documents/" + clean_rel,

            ):

                try:

                    res = httpx.get(candidate, headers=self._headers(), timeout=20, follow_redirects=True)

                    if res.status_code == 200 and res.content:

                        return res.content

                except Exception:

                    pass

        return None

    def upload_cropped_copy(self, app_id: str, ref_no: str, jpeg_bytes: bytes) -> Optional[str]:

        url, key = self._credentials()

        if not url or not key or not jpeg_bytes:

            return None

        safe_ref = self._SAFE_REF_REGEX.sub("", str(ref_no or "app"))

        object_path = f"cropped/{safe_ref}-{int(time.time())}.jpg"

        upload_url = f"{url}/storage/v1/object/documents/{object_path}"

        try:

            res = httpx.post(

                upload_url,

                headers=self._headers({"Content-Type": "image/jpeg", "x-upsert": "true"}),

                content=jpeg_bytes,

                timeout=20,

            )

            if res.status_code in (200, 201):

                public_url = f"{url}/storage/v1/object/public/documents/{object_path}"

                self.insert_document_record(app_id, "id_front_cropped", public_url, "cropped")

                return public_url

        except Exception as err:

            print("[screening] cropped upload error:", err)

        return None

    def insert_document_record(self, app_id: str, doc_type: str, file_path: str, version: str) -> None:

        url, key = self._credentials()

        if not url or not key:

            return

        try:

            httpx.post(

                url + "/rest/v1/documents",

                headers=self._headers({"Content-Type": "application/json", "Prefer": "return=minimal"}),

                json={

                    "application_id": app_id,

                    "doc_type": doc_type,

                    "file_path": file_path,

                    "version": version,

                    "created_at": _iso_now(),

                },

                timeout=10,

            )

        except Exception:

            pass

    def insert_screening_record(self, app_id: str, quality_obj: dict, ocr_obj: dict, comparisons: list, remark: str) -> None:

        url, key = self._credentials()

        if not url or not key:

            return

        try:

            httpx.post(

                url + "/rest/v1/screenings",

                headers=self._headers({"Content-Type": "application/json", "Prefer": "return=minimal"}),

                json={

                    "application_id": app_id,

                    "quality": quality_obj,

                    "ocr": ocr_obj,

                    "comparisons": comparisons,

                    "ai_remark": remark,

                    "status": "completed",

                    "created_at": _iso_now(),

                },

                timeout=10,

            )

        except Exception:

            pass

    def insert_correction_record(self, app_id: str, issue_note: str) -> None:

        url, key = self._credentials()

        if not url or not key:

            return

        try:

            httpx.post(

                url + "/rest/v1/corrections",

                headers=self._headers({"Content-Type": "application/json", "Prefer": "return=minimal"}),

                json={

                    "application_id": app_id,

                    "agent_id": "screening",

                    "issue_note": issue_note,

                    "status": "Pending Customer",

                    "created_at": _iso_now(),

                },

                timeout=10,

            )

        except Exception:

            pass

    def insert_notification(self, email: Optional[str], role: Optional[str], title: str, message: str) -> None:

        url, key = self._credentials()

        if not url or not key:

            return

        try:

            httpx.post(

                url + "/rest/v1/notifications",

                headers=self._headers({"Content-Type": "application/json", "Prefer": "return=minimal"}),

                json={

                    "email": email,

                    "role": role,

                    "title": title,

                    "message": message,

                    "is_read": False,

                    "created_at": _iso_now(),

                },

                timeout=10,

            )

        except Exception:

            pass

class BackgroundScreeningCoordinator:

    def __init__(self, gateway: SupabaseApplicationGateway, max_workers: int = 4) -> None:

        self._gateway = gateway

        self._executor = ThreadPoolExecutor(max_workers=max_workers)

        self._lock = threading.Lock()

        self._active_jobs: Dict[str, str] = {}

        self._last_unavailable_alert_ts: float = 0.0

    def active_count(self) -> int:

        with self._lock:

            return len(self._active_jobs)

    def _notify_staff_unavailable(self, ref_no: str, cust_name: str, reason_note: str) -> None:

        now_ts = time.time()

        should_send = False

        with self._lock:

            if (now_ts - self._last_unavailable_alert_ts) >= 60.0:

                self._last_unavailable_alert_ts = now_ts

                should_send = True

        if should_send:

            title = f"Auto-Screening Unavailable ({ref_no})"

            msg = (

                f"Auto-screening is currently not active for {ref_no} ({cust_name}). "

                f"{reason_note} The customer's original uploaded ID copy is ready for manual review."

            )

            self._gateway.insert_notification(None, "agent", title, msg)

            self._gateway.insert_notification(None, "manager", title, msg)

    def _summarize_comparisons(self, comparisons: List[Dict[str, Any]]) -> Dict[str, Any]:

        name_ok = True

        birth_ok = True

        id_ok = True

        mismatches = []

        for row in comparisons:

            key = row.get("key") or row.get("field", "").lower()

            res = row.get("result", "")

            if res == "mismatch":

                if "name" in key:

                    name_ok = False

                    mismatches.append(("name", "Full name"))

                elif "birth" in key:

                    birth_ok = False

                    mismatches.append(("birth_date", "Birth date"))

                elif "id" in key:

                    id_ok = False

                    mismatches.append(("id_number", "ID number"))

        return {

            "name_match": name_ok,

            "birth_date_match": birth_ok,

            "id_number_match": id_ok,

            "mismatches": mismatches,

        }

    def enqueue(self, app_id: str) -> Dict[str, Any]:

        clean_id = (app_id or "").strip()

        if not clean_id:

            return {"queued": False, "reason": "Missing application_id"}

        with self._lock:

            if clean_id in self._active_jobs:

                return {"queued": True, "already_running": True, "application_id": clean_id}

            self._active_jobs[clean_id] = "queued"

        self._executor.submit(self._run_pipeline, clean_id)

        return {

            "queued": True,

            "application_id": clean_id,

            "estimated_seconds": 35,

        }

    def _run_pipeline(self, app_id: str) -> None:

        ref_no = app_id

        cust_name = "Applicant"

        existing_scr: Dict[str, Any] = {}

        try:

            app = self._gateway.fetch_application(app_id)

            if not app:

                return

            ref_no = app.get("ref_no") or app.get("reference_no") or app_id

            cust_name = app.get("full_name") or "Applicant"

            existing_scr = app.get("screening") if isinstance(app.get("screening"), dict) else {}

            logs = app.get("ai_log") if isinstance(app.get("ai_log"), list) else []

            if not self._gateway.is_screening_enabled():

                paused_scr = dict(existing_scr)

                paused_scr.update({

                    "state": "paused",

                    "phase": "Original Copy Ready (Manual Review)",

                    "eta_seconds": 0,

                    "fallback_original_only": True,

                    "severity": "info",

                    "advisory": "Auto-screening is currently paused. Original uploaded ID copies are ready for manual verification.",

                })

                logs.append({

                    "at": _iso_now(),

                    "who": "Application Screening",

                    "text": "Auto-screening paused: original uploaded ID copy forwarded for manual review.",

                })

                self._gateway.update_application(app_id, {"screening": paused_scr, "ai_log": logs})

                self._notify_staff_unavailable(ref_no, cust_name, "Automated screening is currently paused.")

                return

            if not quality.is_available() and not ocr.is_available():

                unavail_scr = dict(existing_scr)

                unavail_scr.update({

                    "state": "unavailable",

                    "phase": "Original Copy Ready (Manual Review)",

                    "eta_seconds": 0,

                    "fallback_original_only": True,

                    "severity": "warning",

                    "advisory": "Auto-screening is currently unavailable. Original uploaded ID copies are ready for manual verification.",

                })

                logs.append({

                    "at": _iso_now(),

                    "who": "Application Screening",

                    "text": "Auto-screening unavailable: original uploaded ID copy forwarded for manual review.",

                })

                self._gateway.update_application(app_id, {"screening": unavail_scr, "ai_log": logs})

                self._notify_staff_unavailable(ref_no, cust_name, "Document screening modules are currently unavailable.")

                return

            layer1_start = dict(existing_scr)

            layer1_start.update({

                "state": "layer1_running",

                "phase": "Analyzing Application and Reading ID",

                "eta_seconds": 35,

                "started_at": _iso_now(),

                "fallback_original_only": False,

                "severity": "info",

                "advisory": "Screening in progress (~30 to 40 seconds remaining). Original submission is available below if you wish to inspect it now.",

            })

            self._gateway.update_application(app_id, {"screening": layer1_start})

            id_source = app.get("id_front_path") or app.get("id_image_url") or ""

            image_bytes = self._gateway.download_id_bytes(id_source)

            if not image_bytes:

                failed_scr = dict(layer1_start)

                failed_scr.update({

                    "state": "completed",

                    "phase": "Original Copy Ready (Manual Review)",

                    "eta_seconds": 0,

                    "fallback_original_only": True,

                    "severity": "warning",

                    "advisory": "Could not load the uploaded ID image for automatic check. Please review the original copy manually.",

                })

                self._gateway.update_application(app_id, {"screening": failed_scr})

                return

            entered = {

                "full_name": app.get("full_name") or "",

                "birth_date": app.get("birth_date") or "",

                "id_number": app.get("id_number") or "",

            }

            q1 = quality.quick_check(image_bytes)

            ocr1 = ocr.read_raw_bytes(image_bytes)

            comp1 = ocr.compare(entered, ocr1.get("lines", []))

            sum1 = self._summarize_comparisons(comp1)

            early_issues = list(q1.get("issues", []))

            for _, lbl in sum1["mismatches"]:

                early_issues.append(lbl + " appears not to match the ID.")

            serious_layer1 = bool(q1.get("severe") or sum1["mismatches"] or not ocr1.get("lines"))

            eta_layer2 = 20 if q1.get("needs_enhancement") else 12

            if serious_layer1:

                short_warn = "; ".join(early_issues[:2]) if early_issues else "unclear ID text"

                advisory_msg = (

                    f"Hold Recommended (~{eta_layer2}s remaining): Initial check flagged potential issues ({short_warn}). "

                    "It is best to wait for document cropping and enhancement to finish before forwarding."

                )

                severity = "warning"

            else:

                advisory_msg = (

                    f"Initial check looks clear. Completing document cropping and final verification (~{eta_layer2}s remaining)..."

                )

                severity = "info"

            layer1_published = dict(layer1_start)

            layer1_published.update({

                "state": "layer2_running",

                "phase": "Cropping and Enhancing Document",

                "eta_seconds": eta_layer2,

                "severity": severity,

                "advisory": advisory_msg,

                "layer1_issues": early_issues,

                "quality": q1,

                "comparisons": comp1,

            })

            self._gateway.update_application(app_id, {"screening": layer1_published})

            q2, working_gray, cropped_jpeg = quality.enhance_and_crop(image_bytes)

            cropped_url = self._gateway.upload_cropped_copy(app_id, ref_no, cropped_jpeg) if cropped_jpeg else None

            ocr2 = ocr.read_text(working_gray)

            if len(ocr2.get("lines", [])) >= len(ocr1.get("lines", [])):

                final_lines = ocr2.get("lines", [])

            else:

                final_lines = ocr1.get("lines", [])

            comp2 = ocr.compare(entered, final_lines)

            sum2 = self._summarize_comparisons(comp2)

            notes = ai.write_guidance(q2, comp2)

            latest_app = self._gateway.fetch_application(app_id) or app

            current_status = latest_app.get("status") or "Pending Review"

            if isinstance(latest_app.get("ai_log"), list):

                logs = latest_app.get("ai_log")

            auto_fields: List[str] = []

            auto_reasons: List[str] = []

            if not final_lines or (q2.get("blur_score", 100) < 42 and sum2["mismatches"]):

                auto_fields.append("id_photo")

                auto_reasons.append("Uploaded Valid ID photo is blurry or unreadable")

            else:

                for key, _ in sum2["mismatches"]:

                    if key == "name":

                        auto_fields.append("name")

                        auto_reasons.append("Applicant name entered on the form does not match the Valid ID")

                    elif key == "id_number":

                        auto_fields.append("id_number")

                        auto_reasons.append("Primary ID number entered does not match the Valid ID")

                    elif key == "birth_date":

                        auto_fields.append("birth_date")

                        auto_reasons.append("Birth date entered does not match the Valid ID")

            overall_status = "Needs Review" if (auto_reasons or q2.get("issues")) else "Verified"

            saved_cropped_url = cropped_url or existing_scr.get("cropped_id_url") or ""

            final_screening = dict(existing_scr)

            final_screening.update({

                "state": "completed",

                "phase": "Screening Complete",

                "eta_seconds": 0,

                "completed_at": _iso_now(),

                "fallback_original_only": False,

                "cropped_id_url": saved_cropped_url,

                "quality": q2,

                "ocr": {"available": ocr2.get("available", False), "lines": final_lines},

                "comparisons": comp2,

                "ai": notes,

                "findings": notes.get("findings", []),

                "guidance": notes.get("guidance", []),

                "severity": "warning" if (auto_reasons or q2.get("issues")) else "ok",

                "advisory": (

                    "Screening complete. Document cropped/enhanced and details verified."

                    if not auto_reasons

                    else "Screening complete. Simple discrepancy detected - customer was automatically notified to update their details."

                ),

            })

            ai_summary_obj = {

                "overall_status": overall_status,

                "readability": q2.get("readability_label", "Checked"),

                "blur_score": q2.get("blur_score", "OK"),

                "name_match": sum2["name_match"],

                "birth_date_match": sum2["birth_date_match"],

                "id_number_match": sum2["id_number_match"],

                "cropped_id_url": saved_cropped_url,

                "issues": notes.get("findings", []),

            }

            self._gateway.insert_screening_record(

                app_id,

                q2,

                {"available": ocr2.get("available", False), "lines": final_lines},

                comp2,

                "; ".join(notes.get("findings", [])),

            )

            can_auto_request = current_status in ("Pending Review", "Processing", "Under Agent Review")

            if auto_fields and can_auto_request:

                reason_str = "; ".join(auto_reasons)

                chosen_key = auto_fields[0] if len(auto_fields) == 1 else "auto"

                polite_res = ai.write_polite_remark(reason_str, chosen_key)

                polite_msg = polite_res.get("message") or (

                    "Hello! While checking your application, we noticed an item that needs a quick update ("

                    + reason_str

                    + "). Please sign in to your Customer Account to update your details so processing can continue."

                )

                final_screening["correction_fields"] = auto_fields

                final_screening["auto_correction_sent"] = True

                final_screening["auto_correction_reason"] = reason_str

                final_screening["auto_correction_at"] = _iso_now()

                logs.append({

                    "at": _iso_now(),

                    "who": "Application Screening",

                    "text": "Automatic update request sent to customer (" + reason_str + ").",

                })

                update_payload = {

                    "status": "Needs Correction",

                    "agent_remarks": polite_msg,

                    "correction_note": polite_msg,

                    "customer_instruction": polite_msg,

                    "cropped_id_path": saved_cropped_url,

                    "screening": final_screening,

                    "ai_result": ai_summary_obj,

                    "ai_log": logs,

                }

                self._gateway.update_application(app_id, update_payload)

                self._gateway.insert_correction_record(app_id, polite_msg)

                cust_email = latest_app.get("email") or ""

                cust_name = latest_app.get("full_name") or "Valued Applicant"

                if cust_email:

                    self._gateway.insert_notification(

                        cust_email,

                        "customer",

                        f"Update Needed for Application ({ref_no})",

                        polite_msg,

                    )

                    try:

                        mailer.send(

                            to=cust_email,

                            subject=f"PIGEM Action Required - Update Needed for Reference No. {ref_no}",

                            message=polite_msg,

                            template_type="correction_notice",

                            payload={

                                "ref_no": ref_no,

                                "customer_name": cust_name,

                                "target_summary": reason_str,

                                "issue_category": reason_str,

                                "portal_link": "http://127.0.0.1:8001/customer.html",

                            },

                        )

                    except Exception:

                        pass

                self._gateway.insert_notification(

                    latest_app.get("assigned_agent") or None,

                    "agent",

                    f"Auto-Update Requested: {ref_no}",

                    f"Screening automatically requested an update from {cust_name} ({reason_str}).",

                )

            else:

                summary_line = (

                    "Document screening passed: ID image checked/cropped and entered details match."

                    if overall_status == "Verified"

                    else "Document screening completed: " + "; ".join(notes.get("findings", ["Review advised."]))

                )

                logs.append({

                    "at": _iso_now(),

                    "who": "Application Screening",

                    "text": summary_line,

                })

                self._gateway.update_application(app_id, {

                    "cropped_id_path": saved_cropped_url,

                    "screening": final_screening,

                    "ai_result": ai_summary_obj,

                    "ai_log": logs,

                })

        except Exception as err:

            print(f"[screening] unhandled error for {app_id}: {err}")

            try:

                fallback_scr = dict(existing_scr)

                fallback_scr.update({

                    "state": "unavailable",

                    "phase": "Original Copy Ready (Manual Review)",

                    "eta_seconds": 0,

                    "fallback_original_only": True,

                    "severity": "warning",

                    "advisory": "Auto-screening encountered an interruption. Original uploaded ID copies are ready for manual verification.",

                })

                self._gateway.update_application(app_id, {"screening": fallback_scr})

                self._notify_staff_unavailable(ref_no, cust_name, "Auto-screening encountered an interruption.")

            except Exception:

                pass

        finally:

            with self._lock:

                self._active_jobs.pop(app_id, None)

_gateway = SupabaseApplicationGateway()

_coordinator = BackgroundScreeningCoordinator(_gateway, max_workers=4)

def active_count() -> int:

    return _coordinator.active_count()

def enqueue_screening(app_id: str) -> Dict[str, Any]:

    return _coordinator.enqueue(app_id)
