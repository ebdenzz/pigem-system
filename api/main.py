"""
PIGEM Web-Based Internet Service Application System with AI-Assisted Requirements Screening
Backend Service (FastAPI)

Scope & Modules according to Technical Documentation:
  1. Technical Management Module (/health):
     Monitors live technical availability of OpenCV, PaddleOCR, Ollama, Resend, and Supabase.
  2. AI-Assisted Requirements Screening (/screen):
     OpenCV image quality check & 4-point perspective transform -> PaddleOCR text extraction ->
     Field comparison -> Ollama (Qwen2.5 1.5B) preliminary findings and suggested correction guidance.
  3. Email Notification Module (/notify):
     Resend transactional email engine for application reference notices, correction notices,
     status updates, agent alerts, and promotional announcements.
  4. AI-Assisted Remark Formulator (/polite-remark):
     Ollama local language model rewriter to translate raw Radius/Validator remarks into polite customer guidance.
  5. Static Web Interface Mount (/):
     Serves the PIGEM web platform on http://127.0.0.1:8001/
"""

import os
from typing import Optional, Dict, Any
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

# Load environment variables from api/.env
_env_file = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_env_file if os.path.exists(_env_file) else None)
load_dotenv()

app = FastAPI(
    title="PIGEM Web-Based Internet Service Application System",
    description="Backend API for AI-Assisted Requirements Screening and Email Notifications"
)

# Allow web interface to communicate with this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local web images directory if present
IMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web", "assets", "images"))
if os.path.isdir(IMAGES_DIR):
    app.mount("/assets/images", StaticFiles(directory=IMAGES_DIR), name="images")

MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB max upload size


@app.get("/health")
def health():
    """
    Technical Management Module - Health Probe:
    Returns the operational status of the local AI components and external service bridges.
    """
    ollama_ok = ai.is_available()
    return {
        "api": True,
        "ollama": ollama_ok,
        "opencv": bool(ollama_ok and quality.is_available()),
        "paddleocr": bool(ollama_ok and ocr.is_available()),
        "resend": mailer.is_configured(),
        "supabase_check": auth.is_configured(),
    }


@app.post("/screen")
async def screen_document(
    id_front: UploadFile = File(...),
    full_name: str = Form(""),
    birth_date: str = Form(""),
    id_number: str = Form(""),
    user=Depends(auth.require_login),
):
    """
    AI-Assisted Requirements Screening Pipeline:
    Step 1: OpenCV assesses image quality (blur, contrast, brightness, orientation, 4-point perspective transform).
    Step 2: PaddleOCR extracts readable text lines from the working copy.
    Step 3: Compares extracted text with customer-entered details (name, birth date, ID number).
    Step 4: Ollama (Qwen2.5 1.5B) generates preliminary findings and suggested correction guidance.
    
    Note: Findings are preliminary support for human Agent review and do not approve or reject applications.
    """
    if not ai.is_available():
        raise HTTPException(
            status_code=503,
            detail="Local Ollama AI service is offline. Please start Ollama (ollama run qwen2.5:1.5b).",
        )

    image_bytes = await id_front.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file exceeds the maximum 8 MB limit.")

    # 1. OpenCV Image Quality Assessment and Auto-Deskew
    quality_result, working_copy = quality.check(image_bytes)

    # 2. PaddleOCR Text Extraction
    ocr_result = ocr.read_text(working_copy)

    # 3. Information Comparison using defined application rules
    entered = {
        "full_name": full_name,
        "birth_date": birth_date,
        "id_number": id_number,
    }
    comparisons = ocr.compare(entered, ocr_result.get("lines", []))

    # 4. Ollama (Qwen2.5 1.5B) preliminary findings and suggested correction guidance
    ai_result = ai.write_guidance(quality_result, comparisons)

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
        "ai": ai_result,
        "notice": "Preliminary AI findings only. Human Agent review is required before issuing any correction request.",
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
    """
    Email Notification Module:
    Dispatches transactional application emails via Resend.
    Templates: otp, application_confirmation, correction_notice, status_update, agent_alert, promotional.
    """
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
    """
    AI-Assisted Polite Remark Formulator:
    Converts raw Radius/Validator remarks into polite, understandable customer correction instructions.
    """
    if not ai.is_available():
        raise HTTPException(
            status_code=503,
            detail="Local Ollama AI service is offline. Please start Ollama or type the instruction manually.",
        )
    return ai.write_polite_remark(data.raw_remark, data.chosen_field)


# Mount and serve the web application directly at http://127.0.0.1:8001/
WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web"))
if os.path.isdir(WEB_DIR):
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
