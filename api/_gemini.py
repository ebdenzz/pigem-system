import base64

from difflib import SequenceMatcher

import json

import os

import re

import httpx

MONTH_MAP = {

    "JAN": "01", "JANUARY": "01",

    "FEB": "02", "FEBRUARY": "02",

    "MAR": "03", "MARCH": "03",

    "APR": "04", "APRIL": "04",

    "MAY": "05",

    "JUN": "06", "JUNE": "06",

    "JUL": "07", "JULY": "07",

    "AUG": "08", "AUGUST": "08",

    "SEP": "09", "SEPT": "09", "SEPTEMBER": "09",

    "OCT": "10", "OCTOBER": "10",

    "NOV": "11", "NOVEMBER": "11",

    "DEC": "12", "DECEMBER": "12",

}

class BaseTextMatcher:

    _NON_ALNUM_REGEX = re.compile(r"[^A-Z0-9\s]")

    _MULTI_SPACE_REGEX = re.compile(r"\s+")

    _COMPACT_ID_REGEX = re.compile(r"[^A-Z0-9]")

    _ISO_DATE_REGEX = re.compile(r"\b(19\d{2}|20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b")

    _MDY_DATE_REGEX = re.compile(r"\b(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])[-/.](19\d{2}|20\d{2})\b")

    _WORD_DATE_1_REGEX = re.compile(r"\b([A-Z]{3,9})\s+(0?[1-9]|[12]\d|3[01]),?\s+(19\d{2}|20\d{2})\b")

    _WORD_DATE_2_REGEX = re.compile(r"\b(0?[1-9]|[12]\d|3[01])\s+([A-Z]{3,9}),?\s+(19\d{2}|20\d{2})\b")

    def compare(self, entered: dict, ocr_payload: dict) -> list:

        raise NotImplementedError("Subclasses must implement compare().")

    def _clean_words(self, text: str) -> str:

        upper = (text or "").upper()

        alnum = self._NON_ALNUM_REGEX.sub(" ", upper)

        return self._MULTI_SPACE_REGEX.sub(" ", alnum).strip()

    def _normalize_id_code(self, text: str) -> str:

        return self._COMPACT_ID_REGEX.sub("", (text or "").upper())

    def _extract_dates(self, text: str) -> set:

        upper = (text or "").upper()

        dates = set()

        for y, m, d in self._ISO_DATE_REGEX.findall(upper):

            dates.add(f"{int(y):04d}-{int(m):02d}-{int(d):02d}")

        for p1, p2, y in self._MDY_DATE_REGEX.findall(upper):

            n1, n2 = int(p1), int(p2)

            if 1 <= n1 <= 12 and 1 <= n2 <= 31:

                dates.add(f"{int(y):04d}-{n1:02d}-{n2:02d}")

            if 1 <= n2 <= 12 and 1 <= n1 <= 31:

                dates.add(f"{int(y):04d}-{n2:02d}-{n1:02d}")

        for mon, day, yr in self._WORD_DATE_1_REGEX.findall(upper):

            if mon in MONTH_MAP:

                dates.add(f"{int(yr):04d}-{MONTH_MAP[mon]}-{int(day):02d}")

        for day, mon, yr in self._WORD_DATE_2_REGEX.findall(upper):

            if mon in MONTH_MAP:

                dates.add(f"{int(yr):04d}-{MONTH_MAP[mon]}-{int(day):02d}")

        return dates

class FieldComparisonEngine(BaseTextMatcher):

    def compare(self, entered: dict, ocr_payload: dict) -> list:

        lines = list(ocr_payload.get("lines") or [])

        ext_name = str(ocr_payload.get("extracted_name") or "").strip()

        ext_dob = str(ocr_payload.get("extracted_birth_date") or "").strip()

        ext_id = str(ocr_payload.get("extracted_id_number") or "").strip()

        combined_chunks = list(lines)

        if ext_name:

            combined_chunks.append(ext_name)

        if ext_dob:

            combined_chunks.append(ext_dob)

        if ext_id:

            combined_chunks.append(ext_id)

        raw_joined = " ".join(combined_chunks)

        clean_ocr = self._clean_words(raw_joined)

        compact_ocr = self._normalize_id_code(raw_joined)

        ocr_words = clean_ocr.split()

        results = []

        entered_name = (entered.get("full_name") or "").strip()

        if entered_name:

            name_parts = [p for p in self._clean_words(entered_name).split() if len(p) > 1 and p != "NA"]

            matched_parts = []

            for part in name_parts:

                if part in ocr_words:

                    matched_parts.append(part)

                else:

                    for word in ocr_words:

                        if SequenceMatcher(None, part, word).ratio() >= 0.80:

                            matched_parts.append(part)

                            break

            ratio = (len(matched_parts) / len(name_parts)) if name_parts else 0.0

            if ratio >= 0.99:

                status, note = "match", "All name parts were found on the ID."

            elif ratio >= 0.50:

                status, note = "partial", f"Found {len(matched_parts)} of {len(name_parts)} name parts on the ID."

            else:

                status, note = "mismatch", "The entered name does not match the name read on the ID."

            results.append({

                "field": "Full Name",

                "key": "name",

                "entered": entered_name,

                "found_on_id": ext_name or (" ".join(matched_parts) if matched_parts else "Not clearly visible"),

                "status": status,

                "note": note,

            })

        entered_dob = (entered.get("birth_date") or "").strip()

        if entered_dob:

            found_dates = self._extract_dates(raw_joined)

            if entered_dob in found_dates:

                dob_status, dob_note = "match", "Birth date matches the date printed on the ID."

                dob_found = entered_dob

            elif len(found_dates) > 0:

                dob_status = "mismatch"

                dob_found = sorted(found_dates)[0]

                dob_note = f"Entered birth date ({entered_dob}) differs from ID date ({dob_found})."

            else:

                dob_status = "partial"

                dob_found = "Not clearly visible"

                dob_note = "Birth date could not be clearly read from the ID photo."

            results.append({

                "field": "Birth Date",

                "key": "birth_date",

                "entered": entered_dob,

                "found_on_id": dob_found,

                "status": dob_status,

                "note": dob_note,

            })

        entered_id = (entered.get("id_number") or "").strip()

        if entered_id:

            compact_id = self._normalize_id_code(entered_id)

            if compact_id and compact_id in compact_ocr:

                id_status, id_note, id_found = "match", "ID number matches the document.", entered_id

            else:

                best_ratio = 0.0

                win = len(compact_id)

                if win >= 4 and len(compact_ocr) >= win:

                    for idx in range(0, len(compact_ocr) - win + 1):

                        piece = compact_ocr[idx : idx + win]

                        score = SequenceMatcher(None, compact_id, piece).ratio()

                        if score > best_ratio:

                            best_ratio = score

                if best_ratio >= 0.85:

                    id_status = "match"

                    id_found = ext_id or entered_id

                    id_note = "ID number closely matches the document."

                elif best_ratio >= 0.65:

                    id_status = "partial"

                    id_found = ext_id or "Partially visible"

                    id_note = "ID number partially matches; Agent verification recommended."

                else:

                    id_status = "mismatch"

                    id_found = ext_id or "Not found on ID"

                    id_note = "Entered ID number was not found on the uploaded ID."

            results.append({

                "field": "ID Number",

                "key": "id_number",

                "entered": entered_id,

                "found_on_id": id_found,

                "status": id_status,

                "note": id_note,

            })

        return results

class BaseLanguageClient:

    _TECH_TERMS_REGEX = re.compile(

        r"\b(OpenCV|Gemini|Google\s+AI|CLAHE|Laplacian|OCR|LLM|Artificial\s+Intelligence|AI)\b",

        re.IGNORECASE,

    )

    _CODE_FENCE_REGEX = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)

    def is_available(self) -> bool:

        raise NotImplementedError("Subclasses must implement is_available().")

    def _sanitize_plain_text(self, text: str) -> str:

        cleaned = self._TECH_TERMS_REGEX.sub("screening", text or "")

        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

        return cleaned

    def _parse_json_text(self, raw_text: str) -> dict:

        stripped = self._CODE_FENCE_REGEX.sub("", (raw_text or "").strip()).strip()

        start = stripped.find("{")

        end = stripped.rfind("}")

        if start != -1 and end != -1 and end > start:

            stripped = stripped[start : end + 1]

        return json.loads(stripped)

class GeminiScreeningService(BaseLanguageClient):

    _API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

    _FIELD_PATTERNS = [

        ("id_photo", re.compile(r"(blur|unclear|dark|glare|flash|unreadable|photo|image|id\s*copy|crop|cut\s*off)", re.I)),

        ("name", re.compile(r"(name|surname|first\s*name|middle\s*name|last\s*name|spelling)", re.I)),

        ("birth_date", re.compile(r"(birth|birthday|dob|date\s*of\s*birth)", re.I)),

        ("id_number", re.compile(r"(id\s*no|id\s*number|card\s*number|license\s*number)", re.I)),

        ("email", re.compile(r"(email|gmail|already\s*registered|existing\s*email|duplicate\s*email)", re.I)),

        ("phone", re.compile(r"(mobile|phone|contact\s*number|cellphone)", re.I)),

        ("address", re.compile(r"(address|street|barangay|landmark|house|location|pin)", re.I)),

    ]

    def _get_config(self) -> tuple:

        api_key = (os.getenv("GEMINI_API_KEY") or "").strip()

        model = (os.getenv("GEMINI_MODEL") or "gemini-flash-latest").strip()

        return api_key, model

    def is_available(self) -> bool:

        api_key, _ = self._get_config()

        return bool(api_key)

    def _call_gemini(self, parts: list, expect_json: bool = True, max_tokens: int = 450) -> str:

        api_key, primary_model = self._get_config()

        if not api_key:

            return ""

        gen_cfg = {"temperature": 0.1, "maxOutputTokens": max_tokens}

        if expect_json:

            gen_cfg["responseMimeType"] = "application/json"

        payload = {

            "contents": [{"parts": parts}],

            "generationConfig": gen_cfg,

        }

        headers = {

            "Content-Type": "application/json",

            "X-goog-api-key": api_key,

        }

        models_to_try = [primary_model]

        if "gemini-2.0-flash" not in models_to_try:

            models_to_try.append("gemini-2.0-flash")

        for model_name in models_to_try:

            url = f"{self._API_BASE}/{model_name}:generateContent"

            try:

                reply = httpx.post(url, headers=headers, json=payload, timeout=22)

                if reply.status_code == 200:

                    data = reply.json()

                    candidates = data.get("candidates") or []

                    if candidates:

                        content = candidates[0].get("content") or {}

                        out_parts = content.get("parts") or []

                        texts = [str(p.get("text") or "") for p in out_parts if p.get("text")]

                        joined = "\n".join(texts).strip()

                        if joined:

                            return joined

            except Exception:

                continue

        return ""

    def extract_id_text(self, image_bytes: bytes) -> dict:

        if not image_bytes or not self.is_available():

            return {

                "available": False,

                "lines": [],

                "extracted_name": "",

                "extracted_birth_date": "",

                "extracted_id_number": "",

                "note": "Vision text extraction is not configured.",

            }

        b64_img = base64.b64encode(image_bytes).decode("ascii")

        prompt = (

            "Read the visible printed text on this Philippine identification card image. "

            "Do NOT guess unreadable characters and do NOT judge authenticity. "

            "Return ONLY valid JSON with these exact keys:\n"

            "{\n"

            '  "extracted_name": "full name printed on the ID or empty string",\n'

            '  "extracted_birth_date": "birth date normalized to YYYY-MM-DD if visible or empty string",\n'

            '  "extracted_id_number": "primary ID number printed on the card or empty string",\n'

            '  "lines": ["every visible text line on the ID in reading order"]\n'

            "}"

        )

        raw = self._call_gemini(

            parts=[

                {"inline_data": {"mime_type": "image/jpeg", "data": b64_img}},

                {"text": prompt},

            ],

            expect_json=True,

            max_tokens=500,

        )

        if not raw:

            return {

                "available": False,

                "lines": [],

                "extracted_name": "",

                "extracted_birth_date": "",

                "extracted_id_number": "",

                "note": "Vision OCR service did not return a response.",

            }

        try:

            parsed = self._parse_json_text(raw)

            raw_lines = parsed.get("lines") or []

            clean_lines = [str(x).strip() for x in raw_lines if str(x).strip()]

            return {

                "available": True,

                "lines": clean_lines,

                "line_count": len(clean_lines),

                "extracted_name": str(parsed.get("extracted_name") or "").strip(),

                "extracted_birth_date": str(parsed.get("extracted_birth_date") or "").strip(),

                "extracted_id_number": str(parsed.get("extracted_id_number") or "").strip(),

            }

        except Exception:

            fallback_lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]

            return {

                "available": True,

                "lines": fallback_lines,

                "line_count": len(fallback_lines),

                "extracted_name": "",

                "extracted_birth_date": "",

                "extracted_id_number": "",

            }

    def detect_target_fields(self, raw_remark: str, chosen_field: str = "") -> list:

        fields = []

        if chosen_field and chosen_field != "auto":

            fields.append(chosen_field)

        for field_key, regex in self._FIELD_PATTERNS:

            if regex.search(raw_remark or "") and field_key not in fields:

                fields.append(field_key)

        return fields or ["general"]

    def _build_rule_guidance(self, quality: dict, comparisons: list) -> dict:

        findings = []

        guidance = []

        for issue in quality.get("issues", []):

            findings.append(issue)

            guidance.append("Ask the customer to upload a clear, well-lit photo of the original Valid ID.")

        for comp in comparisons:

            field_name = comp.get("field", "Detail")

            status = comp.get("status", "")

            if status == "mismatch":

                findings.append(f"{field_name} entered on the form does not match the uploaded ID.")

                guidance.append(f"Please inspect the ID and confirm whether the customer should update their {field_name.lower()}.")

            elif status == "partial":

                findings.append(f"{field_name} could only be partially verified from the ID photo.")

                guidance.append(f"Visually verify the {field_name.lower()} on the ID before forwarding for encoding.")

        if not findings:

            findings.append("Document photo is clear and entered details match the uploaded ID.")

            guidance.append("Ready for Agent review and provider encoding preparation.")

        return {"findings": findings[:4], "guidance": guidance[:4]}

    def write_guidance(self, quality: dict, comparisons: list) -> dict:

        fallback = self._build_rule_guidance(quality, comparisons)

        if not self.is_available():

            return {"available": False, **fallback}

        summary_data = {

            "image_issues": quality.get("issues", []),

            "field_checks": [

                {"field": c.get("field"), "status": c.get("status"), "note": c.get("note")}

                for c in comparisons

            ],

        }

        prompt = (

            "You are an application screening co-pilot assisting a human Verification Agent at an internet service company. "

            "Do NOT mention technical words like AI, Gemini, OCR, or OpenCV. "

            "Remember these findings are preliminary for human review only. "

            "Summarize these screening checks in plain, professional English. "

            'Return ONLY valid JSON: {"findings": ["short point"], "guidance": ["short action tip for the agent"]}.\n\n'

            "Checks:\n" + json.dumps(summary_data)

        )

        raw = self._call_gemini(parts=[{"text": prompt}], expect_json=True, max_tokens=280)

        if raw:

            try:

                parsed = self._parse_json_text(raw)

                f_list = [self._sanitize_plain_text(str(x)) for x in (parsed.get("findings") or []) if str(x).strip()]

                g_list = [self._sanitize_plain_text(str(x)) for x in (parsed.get("guidance") or []) if str(x).strip()]

                if f_list and g_list:

                    return {"available": True, "findings": f_list[:4], "guidance": g_list[:4]}

            except Exception:

                pass

        return {"available": True, **fallback}

    def write_polite_remark(self, raw_remark: str, chosen_field: str = "") -> dict:

        clean_note = (raw_remark or "").strip()

        target_fields = self.detect_target_fields(clean_note, chosen_field)

        primary = target_fields[0]

        polite_defaults = {

            "id_photo": (

                "Hello! Thank you for applying with PIGEM. Could you please upload a clearer, well-lit photo "

                "of your valid ID without glare so our team can verify your details and continue processing your application?"

            ),

            "name": (

                "Hello! Thank you for applying with PIGEM. We noticed a slight difference between the name on your form "

                "and your valid ID—please review and update your name in your portal so it matches your ID."

            ),

            "birth_date": (

                "Hello! Thank you for applying with PIGEM. Please check and update your date of birth in your Customer Portal "

                "so it matches the birth date printed on your valid ID."

            ),

            "id_number": (

                "Hello! Thank you for applying with PIGEM. Please review and update your ID number in your Customer Portal "

                "so it matches the number printed on your submitted valid ID."

            ),

            "email": (

                "Hello! Thank you for applying with PIGEM. It looks like your email address already has an active registration "

                "with the provider—could you please provide an alternative active email address to continue processing?"

            ),

            "phone": (

                "Hello! Thank you for applying with PIGEM. Please review or provide an active mobile number in your "

                "Customer Portal so our team can reach you smoothly regarding your installation."

            ),

            "address": (

                "Hello! Thank you for applying with PIGEM. Could you please confirm or update your complete installation "

                "address and nearest landmark in your Customer Portal so we can verify fiber coverage accurately?"

            ),

            "general": (

                "Hello! Thank you for applying with PIGEM. Please sign in to your Customer Portal to review and update "

                "the highlighted details on your application so we can continue processing your request right away."

            ),

        }

        fallback_msg = polite_defaults.get(primary, polite_defaults["general"])

        if not clean_note or not self.is_available():

            return {

                "available": self.is_available(),

                "polite_message": fallback_msg,

                "target_fields": target_fields,

            }

        prompt = (

            "Rewrite the staff verification note below into a warm, polite, plain-English 2-sentence message "

            "to a home internet applicant asking them to update the specific detail in their Customer Portal. "

            "Do NOT mention AI, Gemini, OCR, or technical terms. Start with 'Hello!'.\n\n"

            f"Verification note: {clean_note}\n"

            f"Target field: {primary}\n"

            'Return ONLY valid JSON: {"polite_message": "..."}'

        )

        raw = self._call_gemini(parts=[{"text": prompt}], expect_json=True, max_tokens=200)

        if raw:

            try:

                parsed = self._parse_json_text(raw)

                msg = self._sanitize_plain_text(str(parsed.get("polite_message") or ""))

                if len(msg) >= 25:

                    return {

                        "available": True,

                        "polite_message": msg,

                        "target_fields": target_fields,

                    }

            except Exception:

                pass

        return {

            "available": True,

            "polite_message": fallback_msg,

            "target_fields": target_fields,

        }

_matcher = FieldComparisonEngine()

_gemini_service = GeminiScreeningService()

def is_available() -> bool:

    return _gemini_service.is_available()

def extract_id_text(image_bytes: bytes) -> dict:

    return _gemini_service.extract_id_text(image_bytes)

def compare_fields(entered: dict, ocr_payload: dict) -> list:

    return _matcher.compare(entered, ocr_payload)

def write_guidance(quality: dict, comparisons: list) -> dict:

    return _gemini_service.write_guidance(quality, comparisons)

def write_polite_remark(raw_remark: str, chosen_field: str = "") -> dict:

    return _gemini_service.write_polite_remark(raw_remark, chosen_field)
