import base64

from datetime import datetime, timezone

import os

import re

import time

import urllib.parse

import httpx

import _gemini

import _quality

def _utc_iso() -> str:

    return datetime.now(timezone.utc).isoformat()

class BaseCloudGateway:

    def is_configured(self) -> bool:

        raise NotImplementedError()

    def fetch_application(self, app_id: str):

        raise NotImplementedError()

    def update_application(self, app_id: str, patch: dict) -> bool:

        raise NotImplementedError()

class SupabaseApplicationGateway(BaseCloudGateway):

    _DATA_URL_REGEX = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,(.+)$")

    def _credentials(self) -> tuple:

        url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")

        key = (os.getenv("SUPABASE_ANON_KEY") or "").strip()

        return url, key

    def is_configured(self) -> bool:

        url, key = self._credentials()

        return bool(url and key)

    def _headers(self, content_type: str = "application/json", extra: dict = None) -> dict:

        _, key = self._credentials()

        hdrs = {

            "apikey": key,

            "Authorization": f"Bearer {key}",

        }

        if content_type:

            hdrs["Content-Type"] = content_type

        if extra:

            hdrs.update(extra)

        return hdrs

    def is_screening_enabled(self) -> bool:

        if not self.is_configured():

            return True

        url, _ = self._credentials()

        try:

            res = httpx.get(

                f"{url}/rest/v1/system_settings?id=eq.main&select=ai_enabled",

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

    def fetch_application(self, app_id: str):

        if not self.is_configured() or not app_id:

            return None

        url, _ = self._credentials()

        safe_id = urllib.parse.quote(str(app_id), safe="")

        try:

            res = httpx.get(

                f"{url}/rest/v1/applications?id=eq.{safe_id}&select=*",

                headers=self._headers(),

                timeout=12,

            )

            if res.status_code == 200:

                rows = res.json()

                return rows[0] if rows else None

        except Exception:

            pass

        return None

    def update_application(self, app_id: str, patch: dict) -> bool:

        if not self.is_configured() or not app_id:

            return False

        url, _ = self._credentials()

        safe_id = urllib.parse.quote(str(app_id), safe="")

        payload = dict(patch)

        payload["updated_at"] = _utc_iso()

        try:

            res = httpx.patch(

                f"{url}/rest/v1/applications?id=eq.{safe_id}",

                headers=self._headers(extra={"Prefer": "return=minimal"}),

                json=payload,

                timeout=12,

            )

            return res.status_code in (200, 204)

        except Exception:

            return False

    def download_id_bytes(self, id_source: str):

        src = (id_source or "").strip()

        if not src:

            return None

        m_b64 = self._DATA_URL_REGEX.match(src)

        if m_b64:

            try:

                return base64.b64decode(m_b64.group(1))

            except Exception:

                return None

        url, _ = self._credentials()

        if src.startswith("http://") or src.startswith("https://"):

            target_url = src

        else:

            clean_path = src.lstrip("/")

            target_url = f"{url}/storage/v1/object/public/documents/{clean_path}"

        try:

            res = httpx.get(target_url, timeout=18, follow_redirects=True)

            if res.status_code == 200 and res.content:

                return res.content

        except Exception:

            pass

        return None

    def upload_cropped_id(self, ref_no: str, jpeg_bytes: bytes) -> str:

        if not self.is_configured() or not jpeg_bytes:

            return ""

        url, _ = self._credentials()

        clean_ref = re.sub(r"[^A-Za-z0-9_-]", "", ref_no or "APP")

        file_path = f"cropped/{clean_ref}-{int(time.time())}.jpg"

        upload_url = f"{url}/storage/v1/object/documents/{file_path}"

        try:

            res = httpx.post(

                upload_url,

                headers=self._headers(content_type="image/jpeg", extra={"x-upsert": "true"}),

                content=jpeg_bytes,

                timeout=18,

            )

            if res.status_code in (200, 201):

                return f"{url}/storage/v1/object/public/documents/{file_path}"

        except Exception:

            pass

        return ""

    def insert_notification(self, row: dict) -> None:

        if not self.is_configured():

            return

        url, _ = self._credentials()

        try:

            httpx.post(

                f"{url}/rest/v1/notifications",

                headers=self._headers(extra={"Prefer": "return=minimal"}),

                json=row,

                timeout=8,

            )

        except Exception:

            pass

    def insert_screening_record(self, app_id: str, quality_obj: dict, ocr_obj: dict, comps: list, remark: str) -> None:

        if not self.is_configured():

            return

        url, _ = self._credentials()

        try:

            httpx.post(

                f"{url}/rest/v1/screenings",

                headers=self._headers(extra={"Prefer": "return=minimal"}),

                json={

                    "application_id": app_id,

                    "quality": quality_obj,

                    "ocr": ocr_obj,

                    "comparisons": comps,

                    "ai_remark": remark,

                    "status": "completed",

                },

                timeout=8,

            )

        except Exception:

            pass

    def insert_document_record(self, app_id: str, doc_type: str, file_path: str, version: str) -> None:

        if not self.is_configured() or not file_path:

            return

        url, _ = self._credentials()

        try:

            httpx.post(

                f"{url}/rest/v1/documents",

                headers=self._headers(extra={"Prefer": "return=minimal"}),

                json={

                    "application_id": app_id,

                    "doc_type": doc_type,

                    "file_path": file_path,

                    "version": version,

                },

                timeout=8,

            )

        except Exception:

            pass

class CloudScreeningCoordinator:

    def __init__(self, gateway: SupabaseApplicationGateway) -> None:

        self._gateway = gateway

        self._last_alert_at = 0.0

    def _notify_staff_unavailable(self, ref_no: str, cust_name: str, reason_note: str) -> None:

        now_ts = time.time()

        if now_ts - self._last_alert_at < 60.0:

            return

        self._last_alert_at = now_ts

        label_ref = ref_no or "New Application"

        applicant = cust_name or "Applicant"

        body = (

            f"Auto-screening is currently not active ({reason_note}). "

            f"{applicant}'s original uploaded Valid ID for {label_ref} is ready for manual verification."

        )

        self._gateway.insert_notification({

            "role": "agent",

            "title": f"Manual Document Review Active ({label_ref})",

            "message": body,

            "is_read": False,

        })

        self._gateway.insert_notification({

            "role": "manager",

            "title": f"Auto-Screening Notice ({label_ref})",

            "message": body,

            "is_read": False,

        })

    def run_pipeline(self, app_id: str) -> dict:

        clean_id = (app_id or "").strip()

        if not clean_id:

            return {"queued": False, "completed": False, "reason": "Missing application_id."}

        if not self._gateway.is_configured():

            return {"queued": False, "completed": False, "reason": "Supabase credentials not configured."}

        app_row = self._gateway.fetch_application(clean_id)

        if not app_row:

            return {"queued": False, "completed": False, "reason": "Application not found."}

        ref_no = app_row.get("ref_no") or app_row.get("reference_no") or clean_id

        cust_name = app_row.get("full_name") or "Customer"

        if not self._gateway.is_screening_enabled():

            self._gateway.update_application(

                clean_id,

                {

                    "screening": {

                        "state": "paused",

                        "phase": "Original Copy Ready (Manual Review)",

                        "eta_seconds": 0,

                        "fallback_original_only": True,

                        "advisory": "Automated screening is paused. Original uploaded ID photo is ready for manual Agent verification.",

                        "updated_at": _utc_iso(),

                    }

                },

            )

            self._notify_staff_unavailable(ref_no, cust_name, "screening paused in settings")

            return {"queued": False, "completed": False, "state": "paused"}

        if not _gemini.is_available():

            self._gateway.update_application(

                clean_id,

                {

                    "screening": {

                        "state": "unavailable",

                        "phase": "Original Copy Ready (Manual Review)",

                        "eta_seconds": 0,

                        "fallback_original_only": True,

                        "advisory": "Screening service is currently unavailable. Original uploaded ID photo is ready for manual Agent verification.",

                        "updated_at": _utc_iso(),

                    }

                },

            )

            self._notify_staff_unavailable(ref_no, cust_name, "vision OCR key not configured")

            return {"queued": False, "completed": False, "state": "unavailable"}

        try:

            self._gateway.update_application(

                clean_id,

                {

                    "screening": {

                        "state": "layer1_running",

                        "phase": "Checking Document Quality",

                        "eta_seconds": 12,

                        "severity": "normal",

                        "advisory": "Checking ID photo clarity and lighting before extracting printed details...",

                        "updated_at": _utc_iso(),

                    }

                },

            )

            id_src = app_row.get("id_front_path") or app_row.get("id_image_url") or ""

            raw_bytes = self._gateway.download_id_bytes(id_src)

            if not raw_bytes:

                self._gateway.update_application(

                    clean_id,

                    {

                        "screening": {

                            "state": "unavailable",

                            "phase": "Original Copy Ready (Manual Review)",

                            "eta_seconds": 0,

                            "fallback_original_only": True,

                            "advisory": "Uploaded ID file could not be fetched automatically. Please inspect the original uploaded photo directly.",

                            "updated_at": _utc_iso(),

                        }

                    },

                )

                return {"queued": False, "completed": False, "state": "unavailable"}

            fast_q = _quality.quick_check(raw_bytes)

            early_warn = bool(fast_q.get("severe") or fast_q.get("issues"))

            stage1_msg = (

                "Hold Recommended: Potential lighting or sharpness issue detected—creating enhanced working copy and extracting text."

                if early_warn

                else "Document clarity checked. Cropping working copy and reading printed details..."

            )

            self._gateway.update_application(

                clean_id,

                {

                    "screening": {

                        "state": "layer2_running",

                        "phase": "Cropping Working Copy and Extracting ID Text",

                        "eta_seconds": 7,

                        "severity": "warning" if early_warn else "normal",

                        "advisory": stage1_msg,

                        "layer1_issues": fast_q.get("issues", []),

                        "updated_at": _utc_iso(),

                    }

                },

            )

            full_q, cropped_jpeg = _quality.enhance_and_crop(raw_bytes)

            cropped_url = ""

            if cropped_jpeg:

                cropped_url = self._gateway.upload_cropped_id(ref_no, cropped_jpeg)

                if cropped_url:

                    self._gateway.insert_document_record(clean_id, app_row.get("id_type") or "Valid ID", cropped_url, "cropped")

            ocr_input_bytes = cropped_jpeg if cropped_jpeg else raw_bytes

            ocr_data = _gemini.extract_id_text(ocr_input_bytes)

            entered_data = {

                "full_name": app_row.get("full_name") or "",

                "birth_date": app_row.get("birth_date") or "",

                "id_number": app_row.get("id_number") or "",

            }

            comparisons = _gemini.compare_fields(entered_data, ocr_data)

            guidance_notes = _gemini.write_guidance(full_q, comparisons)

            suggested_fields = []

            concern_reasons = []

            if full_q.get("issues") and (not full_q.get("readable")) and float(full_q.get("blur_score", 100)) < 48.0:

                suggested_fields.append("id_photo")

                concern_reasons.append("Unclear or blurry Valid ID photo")

            for comp in comparisons:

                c_key = comp.get("key")

                if comp.get("status") == "mismatch" and c_key in ("name", "birth_date", "id_number"):

                    if c_key not in suggested_fields:

                        suggested_fields.append(c_key)

                    concern_reasons.append(f"{comp.get('field')} mismatch with Valid ID")

            review_recommended = bool(len(suggested_fields) > 0 or full_q.get("issues"))

            suggested_polite_message = ""

            suggested_summary = ", ".join(concern_reasons) if concern_reasons else ""

            if review_recommended:

                raw_summary = suggested_summary or "; ".join(full_q.get("issues") or ["Document clarification needed"])

                primary_field = suggested_fields[0] if suggested_fields else "id_photo"

                polite_res = _gemini.write_polite_remark(raw_summary, primary_field)

                suggested_polite_message = polite_res.get("polite_message") or ""

            findings_list = guidance_notes.get("findings") or full_q.get("issues") or ["Document clear and details match."]

            overall_status = "Needs Review" if review_recommended else "Verified"

            ai_result_obj = {

                "preliminary": True,

                "overall_status": overall_status,

                "blur_score": full_q.get("blur_score", "OK"),

                "readability_label": full_q.get("readability_label", "Clear"),

                "cropped_id_url": cropped_url,

                "quality": full_q,

                "ocr": ocr_data,

                "comparisons": comparisons,

                "issues": findings_list,

                "guidance": guidance_notes.get("guidance", []),

                "suggested_fields": suggested_fields,

                "suggested_polite_message": suggested_polite_message,

                "name_match": all(c.get("status") == "match" for c in comparisons if c.get("key") == "name"),

                "birth_date_match": all(c.get("status") != "mismatch" for c in comparisons if c.get("key") == "birth_date"),

                "id_number_match": all(c.get("status") == "match" for c in comparisons if c.get("key") == "id_number"),

            }

            final_advisory = (

                f"Preliminary finding for Agent review: {suggested_summary or '; '.join(findings_list[:2])}."

                if review_recommended

                else "Screening completed: ID working copy is clear and entered details match extracted information."

            )

            final_screening = {

                "state": "completed",

                "phase": "Preliminary Findings Ready" if review_recommended else "Screening Passed",

                "eta_seconds": 0,

                "severity": "warning" if review_recommended else "ok",

                "advisory": final_advisory,

                "cropped_id_url": cropped_url,

                "review_recommended": review_recommended,

                "suggested_fields": suggested_fields,

                "suggested_summary": suggested_summary,

                "suggested_polite_message": suggested_polite_message,

                "fallback_original_only": False,

                "completed_at": _utc_iso(),

            }

            existing_logs = app_row.get("ai_log") if isinstance(app_row.get("ai_log"), list) else []

            existing_logs = list(existing_logs)

            existing_logs.append({

                "id": f"scr-{int(time.time() * 1000)}",

                "actor": "Screening",

                "message": final_advisory,

                "created_at": _utc_iso(),

            })

            patch_data = {

                "ai_result": ai_result_obj,

                "screening": final_screening,

                "ai_log": existing_logs,

            }

            if cropped_url:

                patch_data["cropped_id_path"] = cropped_url

            self._gateway.update_application(clean_id, patch_data)

            self._gateway.insert_screening_record(clean_id, full_q, ocr_data, comparisons, "; ".join(findings_list))

            return {

                "queued": True,

                "completed": True,

                "state": "completed",

                "review_recommended": review_recommended,

                "cropped_id_url": cropped_url,

            }

        except Exception as err:

            self._gateway.update_application(

                clean_id,

                {

                    "screening": {

                        "state": "unavailable",

                        "phase": "Original Copy Ready (Manual Review)",

                        "eta_seconds": 0,

                        "fallback_original_only": True,

                        "advisory": "Automated screening encountered an interruption. Original uploaded ID photo is ready for manual Agent verification.",

                        "error": str(err),

                        "updated_at": _utc_iso(),

                    }

                },

            )

            self._notify_staff_unavailable(ref_no, cust_name, "screening interruption")

            return {"queued": False, "completed": False, "state": "unavailable", "reason": str(err)}

_gateway = SupabaseApplicationGateway()

_coordinator = CloudScreeningCoordinator(_gateway)

def run_application_screening(app_id: str) -> dict:

    return _coordinator.run_pipeline(app_id)
