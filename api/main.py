import os
from typing import Any, Dict, Optional
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import ai
import auth
import mailer
import ocr
import quality
import screening

_env_file = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_file):
    load_dotenv(_env_file)
else:
    load_dotenv()

app = FastAPI(title="PIGEM Application System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

IMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web", "assets", "images"))
if os.path.isdir(IMAGES_DIR):
    app.mount("/assets/images", StaticFiles(directory=IMAGES_DIR), name="images")

MAX_IMAGE_BYTES = 8 * 1024 * 1024

@app.get("/health")
def health():
    ollama_ok = ai.is_available()
    smtp_ok = mailer.is_configured()
    return {
        "api": True,
        "ollama": ollama_ok,
        "opencv": bool(quality.is_available()),
        "paddleocr": bool(ocr.is_available()),
        "active_screenings": screening.active_count(),
        "smtp": smtp_ok,
        "resend": smtp_ok,
        "supabase_check": auth.is_configured(),
    }

class AsyncScreenRequest(BaseModel):
    application_id: str

@app.post("/screen-async")
def screen_document_async(data: AsyncScreenRequest, user=Depends(auth.require_login)):
    return screening.enqueue_screening(data.application_id)

@app.post("/screen")
async def screen_document(
    id_front: UploadFile = File(...),
    full_name: str = Form(""),
    birth_date: str = Form(""),
    id_number: str = Form(""),
    user=Depends(auth.require_login),
):
    image_bytes = await id_front.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file exceeds the 8 MB limit.")

    quality_result, working_copy = quality.check(image_bytes)
    ocr_result = ocr.read_text(working_copy)

    entered = {
        "full_name": full_name,
        "birth_date": birth_date,
        "id_number": id_number,
    }
    comparisons = ocr.compare(entered, ocr_result.get("lines", []))
    notes = ai.write_guidance(quality_result, comparisons)

    return {
        "preliminary": True,
        "status": "human_review_required",
        "quality": quality_result,
        "ocr": {
            "available": ocr_result["available"],
            "note": ocr_result.get("note", ""),
            "lines": ocr_result.get("lines", []),
        },
        "comparisons": comparisons,
        "ai": notes,
        "notice": "Preliminary screening findings only.",
    }

class EmailRequest(BaseModel):
    to: str
    subject: str = "Official Notification"
    message: str = ""
    template_type: str = "general"
    payload: Optional[Dict[str, Any]] = None
    html_content: Optional[str] = None

@app.post("/notify")
def send_notification_email(data: EmailRequest, user=Depends(auth.require_login)):
    return mailer.send(
        to=data.to,
        subject=data.subject,
        message=data.message,
        html_content=data.html_content,
        template_type=data.template_type,
        payload=data.payload,
    )

class PoliteRemarkRequest(BaseModel):
    raw_remark: str = ""
    chosen_field: str = "auto"

@app.post("/polite-remark")
def generate_polite_remark(data: PoliteRemarkRequest, user=Depends(auth.require_login)):
    return ai.write_polite_remark(data.raw_remark, data.chosen_field)

WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web"))
if os.path.isdir(WEB_DIR):
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
