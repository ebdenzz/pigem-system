"""
Local AI guidance with Ollama (Qwen2.5 1.5B).

MAJOR: The AI only WRITES short findings and tips for the Agent. It cannot approve,
reject, verify identity, or run OCR. If Ollama is off, simple rules write the tips instead.
"""
import json
import os

import httpx

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b")


def is_available() -> bool:
    """MINOR: true when Ollama is running AND the model has been downloaded."""
    try:
        tags = httpx.get(OLLAMA_URL + "/api/tags", timeout=2).json()
        return any(m.get("name", "").startswith(MODEL.split(":")[0]) for m in tags.get("models", []))
    except Exception:
        return False


def _rule_based(quality, comparisons):
    """MAJOR: Plain rules used when the AI is not available."""
    findings, guidance = [], []
    for issue in quality.get("issues", []):
        findings.append(issue)
    if quality.get("issues"):
        guidance.append("Ask the customer to upload a clearer photo of the ID.")
    for row in comparisons:
        if row["result"] in ("mismatch", "partial"):
            findings.append(row["field"] + " may not match the ID (" + row["result"] + ").")
            guidance.append("Check the " + row["field"].lower() + " against the original ID image.")
    if not findings:
        findings.append("No problems were detected by the automatic checks.")
        guidance.append("Still review the original ID image yourself.")
    return findings, guidance


def write_guidance(quality, comparisons):
    findings, guidance = _rule_based(quality, comparisons)
    fallback = {"available": False, "source": "rules", "findings": findings, "guidance": guidance}

    # MINOR: build a short factual summary for the model
    facts = {"image_issues": quality.get("issues", []),
             "comparisons": [{"field": c["field"], "result": c["result"]} for c in comparisons]}
    prompt = (
        "You help an internet company agent review an application. Use ONLY these facts:\n"
        + json.dumps(facts)
        + "\nWrite preliminary findings and short, polite correction tips for the customer."
        " Do NOT approve, reject, or say the ID is real or fake."
        ' Reply as JSON: {"findings": ["..."], "guidance": ["..."]} with at most 4 items each.'
    )
    try:
        reply = httpx.post(
            OLLAMA_URL + "/api/generate",
            json={"model": MODEL, "prompt": prompt, "stream": False, "format": "json"},
            timeout=60,
        ).json()
        data = json.loads(reply["response"])
        ai_findings = [str(x) for x in data.get("findings", [])][:4]
        ai_guidance = [str(x) for x in data.get("guidance", [])][:4]
        if not ai_findings:
            return fallback
        return {"available": True, "source": "ollama:" + MODEL, "findings": ai_findings, "guidance": ai_guidance}
    except Exception:
        return fallback  # MINOR: any problem means we use the simple rules



def detect_target_fields(raw_remark: str, chosen_field: str = "") -> list:
    """MAJOR: Detect which specific field(s) the customer must change."""
    if chosen_field and chosen_field != "auto":
        return [chosen_field]

    text = (raw_remark or "").lower()
    fields = []
    if "email" in text or "e-mail" in text or "gmail" in text:
        fields.append("email")
    if "phone" in text or "mobile" in text or "contact" in text or "number already" in text:
        fields.append("phone")
    if "blur" in text or "glare" in text or "photo" in text or "upload" in text or "unreadable" in text:
        fields.append("id_photo")
    if "id no" in text or "id number" in text or "mismatch" in text:
        fields.append("id_number")
    if "address" in text or "street" in text or "barangay" in text or "location" in text:
        fields.append("address")
    if not fields:
        fields.append("general")
    return fields


def write_polite_remark(raw_remark: str, chosen_field: str = "auto"):
    """MAJOR: Convert raw validator/RADIUS remark into a polite customer instruction."""
    fields = detect_target_fields(raw_remark, chosen_field)

    # Default polite message if Ollama is offline or busy
    if "email" in fields and "phone" not in fields:
        default_msg = (
            "Hello! During provider encoding, our system detected that your Email Address is already "
            "registered in the provider portal. Please provide a new, unused Email Address in your "
            "correction form so we can continue processing your application."
        )
    elif "phone" in fields and "email" not in fields:
        default_msg = (
            "Hello! During provider encoding, our system detected that your Mobile Number is already "
            "registered in the provider portal. Please provide a new, unused Mobile Number in your "
            "correction form so we can continue processing your application."
        )
    elif "email" in fields and "phone" in fields:
        default_msg = (
            "Hello! During provider encoding, the provider portal flagged that your Email Address and/or "
            "Mobile Number is already registered. Please update the flagged contact detail with a new one "
            "so we can continue processing your application."
        )
    elif "id_photo" in fields:
        default_msg = (
            "Hello! We could not clearly read your uploaded Valid ID photo (" + (raw_remark or "image unclear") + "). "
            "Please upload a clearer, well-lit photo of your Valid ID so we can complete your verification."
        )
    else:
        default_msg = (
            "Hello! We need a quick update on your application (" + (raw_remark or "please check your details") + "). "
            "Please update the highlighted information in your portal and resubmit so we can continue processing."
        )

    prompt = (
        "You are a polite customer support assistant for PIGEM internet application services.\n"
        f"Raw validator remark: {raw_remark}\n"
        f"Specific field to update: {', '.join(fields)}\n"
        "Write a short, polite 2-sentence message to the customer explaining what specific field they need to "
        "change or re-upload so their application can continue processing. "
        'Reply as JSON: {"message": "..."}'
    )
    try:
        reply = httpx.post(
            OLLAMA_URL + "/api/generate",
            json={"model": MODEL, "prompt": prompt, "stream": False, "format": "json"},
            timeout=25,
        ).json()
        data = json.loads(reply.get("response", "{}"))
        polite = str(data.get("message", "")).strip()
        if polite:
            return {"message": polite, "fields": fields, "source": "ollama:" + MODEL}
    except Exception:
        pass

    return {"message": default_msg, "fields": fields, "source": "rules"}
