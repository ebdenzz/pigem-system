import json

import os

import re

import httpx

class BaseLanguageClient:

    _TECH_TERMS_REGEX = re.compile(

        r"\b(OpenCV|PaddleOCR|Ollama|Qwen\S*|CLAHE|Laplacian|AI)\b",

        re.IGNORECASE,

    )

    _DUP_WORD_REGEX = re.compile(r"\bscreening\s+screening\b", re.IGNORECASE)

    def __init__(self) -> None:

        self._ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")

        self._model = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")

    def is_available(self) -> bool:

        try:

            tags = httpx.get(self._ollama_url + "/api/tags", timeout=2).json()

            prefix = self._model.split(":")[0]

            for item in tags.get("models", []):

                if str(item.get("name", "")).startswith(prefix):

                    return True

            return False

        except Exception:

            return False

    def _sanitize_plain_text(self, text: str) -> str:

        cleaned = self._TECH_TERMS_REGEX.sub("screening", str(text or ""))

        cleaned = self._DUP_WORD_REGEX.sub("screening", cleaned)

        return cleaned.strip()

    def _generate_json(self, prompt: str, timeout_sec: int = 30):

        reply = httpx.post(

            self._ollama_url + "/api/generate",

            json={

                "model": self._model,

                "prompt": prompt,

                "stream": False,

                "format": "json",

            },

            timeout=timeout_sec,

        ).json()

        return json.loads(reply.get("response", "{}"))

class ScreeningLanguageAssistant(BaseLanguageClient):

    _FIELD_PATTERNS = [

        ("name", re.compile(r"\b(name|first\s+name|last\s+name|surname)\b", re.IGNORECASE)),

        ("birth_date", re.compile(r"\b(birth|birthday|date\s+of\s+birth)\b", re.IGNORECASE)),

        ("email", re.compile(r"\b(email|e-mail|gmail)\b", re.IGNORECASE)),

        ("phone", re.compile(r"\b(phone|mobile|contact|number\s+already)\b", re.IGNORECASE)),

        ("id_photo", re.compile(r"\b(blur\w*|glare|photo|upload|unreadable|dark)\b", re.IGNORECASE)),

        ("id_number", re.compile(r"\b(id\s*no|id\s*number)\b", re.IGNORECASE)),

        ("address", re.compile(r"\b(address|street|barangay|location)\b", re.IGNORECASE)),

    ]

    _FRIENDLY_LABELS = {

        "name": "Full Name",

        "birth_date": "Birth Date",

        "id_number": "Valid ID Number",

        "id_photo": "Valid ID Photo",

        "email": "Email Address",

        "phone": "Mobile Number",

        "address": "Installation Address",

        "general": "Application Details",

    }

    def _build_rule_guidance(self, quality: dict, comparisons: list) -> tuple:

        findings = []

        guidance = []

        for issue in quality.get("issues", []):

            findings.append(self._sanitize_plain_text(issue))

        if quality.get("issues"):

            guidance.append("Request a clearer, well-lit photo of the Valid ID if details are unreadable.")

        for row in comparisons:

            result = row.get("result", "")

            field_label = row.get("field", "Detail")

            if result == "mismatch":

                findings.append(field_label + " entered on the form does not match the Valid ID.")

                guidance.append("Verify the applicant's " + field_label.lower() + " against the ID photo.")

            elif result == "partial":

                findings.append(field_label + " partially matched the Valid ID and may need quick visual confirmation.")

                guidance.append("Confirm the " + field_label.lower() + " visually before forwarding.")

        if not findings:

            findings.append("Document is clear and entered details match the Valid ID.")

            guidance.append("Ready for agent check and forwarding to the provider validator.")

        return findings, guidance

    def write_guidance(self, quality: dict, comparisons: list) -> dict:

        findings, guidance = self._build_rule_guidance(quality, comparisons)

        fallback = {

            "available": False,

            "source": "rules",

            "findings": findings,

            "guidance": guidance,

        }

        facts = {

            "image_issues": quality.get("issues", []),

            "comparisons": [{"field": c["field"], "result": c["result"]} for c in comparisons],

        }

        prompt = (

            "You summarize a Valid ID check of a customer's internet application. Use ONLY these facts:\n"

            + json.dumps(facts)

            + "\nRefer to the person as 'the applicant'."

            " Write short, plain-English findings and next-step tips."

            " NEVER use technical words like AI, OCR, OpenCV, algorithm, or model."

            " Do NOT approve or reject the application."

            ' Reply as JSON: {"findings": ["..."], "guidance": ["..."]} with at most 3 items each.'

        )

        try:

            data = self._generate_json(prompt, timeout_sec=45)

            out_findings = []

            out_guidance = []

            for item in data.get("findings", []):

                if str(item).strip():

                    out_findings.append(self._sanitize_plain_text(item))

            for tip in data.get("guidance", []):

                if str(tip).strip():

                    out_guidance.append(self._sanitize_plain_text(tip))

            if not out_findings:

                return fallback

            return {

                "available": True,

                "source": "ollama:" + self._model,

                "findings": out_findings[:3],

                "guidance": out_guidance[:3],

            }

        except Exception:

            return fallback

    def detect_target_fields(self, raw_remark: str, chosen_field: str = "") -> list:

        if chosen_field and chosen_field != "auto":

            if chosen_field == "email_or_phone":

                return ["email", "phone"]

            return [chosen_field]

        text = str(raw_remark or "")

        detected = []

        for field_key, regex in self._FIELD_PATTERNS:

            if regex.search(text):

                if field_key not in detected:

                    detected.append(field_key)

        if not detected:

            if "mismatch" in text.lower():

                detected.append("id_number")

            else:

                detected.append("general")

        return detected

    def write_polite_remark(self, raw_remark: str, chosen_field: str = "auto") -> dict:

        fields = self.detect_target_fields(raw_remark, chosen_field)

        if "name" in fields and len(fields) == 1:

            default_msg = (

                "Hello! While reviewing your application, we noticed that the name entered on your form "

                "does not match the name printed on your Valid ID. Please update your Full Name or upload a matching Valid ID in your Customer Account so we can continue processing."

            )

        elif "birth_date" in fields and len(fields) == 1:

            default_msg = (

                "Hello! While reviewing your application, we noticed that the birth date entered on your form "

                "does not match your Valid ID. Please check and update your Birth Date in your Customer Account."

            )

        elif "id_number" in fields and "id_photo" not in fields:

            default_msg = (

                "Hello! While reviewing your application, we noticed that the ID Number entered on your form "

                "does not match the number printed on your Valid ID. Please check and update your ID Number in your Customer Account."

            )

        elif "email" in fields and "phone" not in fields:

            default_msg = (

                "Hello! During verification, we found that your Email Address is already registered "

                "with the provider. Please provide an alternate active Email Address so we can continue processing your application."

            )

        elif "phone" in fields and "email" not in fields:

            default_msg = (

                "Hello! During verification, we found that your Mobile Number is already registered "

                "with the provider. Please provide a different Mobile Number so we can continue processing your application."

            )

        elif "email" in fields and "phone" in fields:

            default_msg = (

                "Hello! Your Email Address and/or Mobile Number is already linked to an existing provider record. "

                "Please update your contact details in your Customer Account so we can proceed."

            )

        elif "id_photo" in fields:

            default_msg = (

                "Hello! Your uploaded Valid ID photo is unclear (" + (raw_remark or "details are hard to read") + "). "

                "Please upload a clearer, well-lit photo of your Valid ID in your Customer Account."

            )

        else:

            default_msg = (

                "Hello! We need a quick update on your application (" + (raw_remark or "please check your submitted details") + "). "

                "Please sign in to your Customer Account to submit the update so processing can continue."

            )

        friendly_labels = [self._FRIENDLY_LABELS.get(f, f) for f in fields]

        prompt = (

            "You are a polite customer support coordinator for PIGEM internet application services.\n"

            f"Issue noted: {raw_remark}\n"

            f"Item to update: {', '.join(friendly_labels)}\n"

            "Write a polite, natural 2-sentence message starting with 'Hello!' explaining the discrepancy and asking the customer "

            "to update that item in their Customer Account so processing can continue. "

            "Do NOT wrap field names in single quotes and NEVER mention AI, OCR, bots, or technical terms. "

            'Reply as JSON: {"message": "..."}'

        )

        try:

            data = self._generate_json(prompt, timeout_sec=25)

            polite = self._sanitize_plain_text(data.get("message", ""))

            if polite:

                return {"message": polite, "fields": fields, "source": "ollama:" + self._model}

        except Exception:

            pass

        return {"message": default_msg, "fields": fields, "source": "rules"}

_assistant = ScreeningLanguageAssistant()

def is_available() -> bool:

    return _assistant.is_available()

def detect_target_fields(raw_remark: str, chosen_field: str = "") -> list:

    return _assistant.detect_target_fields(raw_remark, chosen_field)

def write_guidance(quality: dict, comparisons: list) -> dict:

    return _assistant.write_guidance(quality, comparisons)

def write_polite_remark(raw_remark: str, chosen_field: str = "auto") -> dict:

    return _assistant.write_polite_remark(raw_remark, chosen_field)
