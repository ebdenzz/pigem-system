"""
PIGEM Cloud Serverless FastAPI Entrypoint (Vercel Python Runtime).
Exposes REST API endpoints for:
  - GET  /api/health         : Live health check (FastAPI, Gemini, OpenCV, reCAPTCHA, Gmail SMTP, Supabase)
  - POST /api/verify-captcha : Google reCAPTCHA v2 server-side SiteVerify check
  - POST /api/screen-async   : Two-stage OpenCV + Gemini Vision OCR screening for Agent review
  - POST /api/screen         : Direct uploaded ID screening endpoint
  - POST /api/notify         : Encrypted Gmail SMTP TLS email notification dispatcher
  - POST /api/polite-remark  : Polite plain-language customer update message generator
"""

import os
import sys
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

_ENV_PATH = os.path.join(_THIS_DIR, ".env")
if load_dotenv is not None and os.path.exists(_ENV_PATH):
    load_dotenv(_ENV_PATH)

import _auth
import _gemini
import _mailer
import _quality
import _screening

app = FastAPI(title="PIGEM Cloud Requirements Screening & Notification API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class CaptchaVerifyRequest(BaseModel):
    token: str


class AsyncScreenRequest(BaseModel):
    application_id: str


class EmailRequest(BaseModel):
    to: str
    subject: str
    message: Optional[str] = ""
    html_content: Optional[str] = None
    template_type: Optional[str] = "general"
    payload: Optional[Dict[str, Any]] = None


class PoliteRemarkRequest(BaseModel):
    raw_remark: str
    chosen_field: Optional[str] = "auto"


@app.get("/api/health")
@app.get("/health")
def health():
    gemini_ok = _gemini.is_available()
    opencv_ok = bool(_quality.is_available())
    smtp_ok = _mailer.is_configured()
    recaptcha_ok = _auth.is_recaptcha_configured()
    return {
        "status": "ok",
        "api": True,
        "gemini": gemini_ok,
        "opencv": opencv_ok,
        "ocr": gemini_ok,
        "auto_screening_ready": bool(opencv_ok and gemini_ok),
        "recaptcha": recaptcha_ok,
        "smtp": smtp_ok,
        "resend": smtp_ok,
        "supabase_check": _auth.is_configured(),
        "active_screenings": 0,
    }


@app.post("/api/verify-captcha")
@app.post("/verify-captcha")
def verify_captcha(data: CaptchaVerifyRequest, request: Request):
    client_ip = request.client.host if request.client else ""
    return _auth.verify_recaptcha(data.token, client_ip)


@app.post("/api/screen-async")
@app.post("/screen-async")
def screen_document_async(data: AsyncScreenRequest, user=Depends(_auth.require_login)):
    return _screening.run_application_screening(data.application_id)


@app.post("/api/screen")
@app.post("/screen")
async def screen_document(
    id_front: UploadFile = File(...),
    full_name: str = Form(""),
    birth_date: str = Form(""),
    id_number: str = Form(""),
    user=Depends(_auth.require_login),
):
    image_bytes = await id_front.read()
    quality_result, cropped_jpeg = _quality.enhance_and_crop(image_bytes)
    ocr_input = cropped_jpeg if cropped_jpeg else image_bytes
    ocr_result = _gemini.extract_id_text(ocr_input)
    entered = {
        "full_name": full_name,
        "birth_date": birth_date,
        "id_number": id_number,
    }
    comparisons = _gemini.compare_fields(entered, ocr_result)
    notes = _gemini.write_guidance(quality_result, comparisons)
    return {
        "preliminary": True,
        "quality": quality_result,
        "ocr": ocr_result,
        "comparisons": comparisons,
        "ai": notes,
    }


@app.post("/api/notify")
@app.post("/notify")
def send_notification(data: EmailRequest, user=Depends(_auth.require_login)):
    return _mailer.send(
        to=data.to,
        subject=data.subject,
        message=data.message or "",
        html_content=data.html_content,
        template_type=data.template_type or "general",
        payload=data.payload,
    )


@app.post("/api/polite-remark")
@app.post("/polite-remark")
def generate_polite_remark(data: PoliteRemarkRequest, user=Depends(_auth.require_login)):
    return _gemini.write_polite_remark(data.raw_remark, data.chosen_field or "auto")
