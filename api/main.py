"""
PIGEM Python Backend Service (FastAPI).

MAJOR: This service handles ONLY:
  1. Document screening (/screen): OpenCV image check + PaddleOCR text extraction + Ollama AI guidance
  2. Email notifications (/notify): Resend email sender
  3. Service health check (/health): tells the Admin page which tools are active
"""
import os
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

# MINOR: Load keys from api/.env if present
load_dotenv()

app = FastAPI(title="PIGEM Screening Service")

# MAJOR: Allow the website (local or Vercel) to call this Python service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# MINOR: Also serve website images from the server at /assets/images/... if needed
IMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web", "assets", "images"))
if os.path.isdir(IMAGES_DIR):
    app.mount("/assets/images", StaticFiles(directory=IMAGES_DIR), name="images")

MAX_IMAGE_BYTES = 4 * 1024 * 1024  # 4 MB max upload size


@app.get("/health")
def health():
    """MAJOR: Returns which backend tools are installed and ready.
    If Ollama is offline, AI-related APIs (OpenCV, PaddleOCR, Ollama) are also marked offline.
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
    """MAJOR: Runs OpenCV -> PaddleOCR -> Field Comparison -> Ollama AI guidance.
    Requires local Ollama AI to be running.
    """
    if not ai.is_available():
        raise HTTPException(
            status_code=503,
            detail="Local Ollama AI is offline. Related AI screening APIs (OpenCV & PaddleOCR) are disabled while Ollama is offline.",
        )

    image_bytes = await id_front.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than 4 MB.")

    # MAJOR: Step 1 - OpenCV checks blur, brightness, contrast, orientation, and cropping
    quality_result, working_copy = quality.check(image_bytes)

    # MAJOR: Step 2 - PaddleOCR extracts readable text from the working copy
    ocr_result = ocr.read_text(working_copy)

    # MAJOR: Step 3 - Compare customer-entered fields with OCR extracted text
    entered = {
        "full_name": full_name,
        "birth_date": birth_date,
        "id_number": id_number,
    }
    comparisons = ocr.compare(entered, ocr_result.get("lines", []))

    # MAJOR: Step 4 - Ollama (Qwen2.5 1.5B) generates preliminary findings and correction tips
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
        "notice": "Preliminary check only. Final review is done by a PIGEM agent.",
    }


class EmailRequest(BaseModel):
    to: str
    subject: str
    message: str


@app.post("/notify")
def send_notification_email(data: EmailRequest, user=Depends(auth.require_login)):
    """MAJOR: Sends an application email notification using Resend."""
    return mailer.send(data.to, data.subject, data.message)


class PoliteRemarkRequest(BaseModel):
    raw_remark: str = ""
    chosen_field: str = "auto"


@app.post("/polite-remark")
def generate_polite_remark(data: PoliteRemarkRequest, user=Depends(auth.require_login)):
    """MAJOR: Converts a raw validator/RADIUS remark into a polite customer message using local Ollama AI."""
    if not ai.is_available():
        raise HTTPException(
            status_code=503,
            detail="Local Ollama AI is offline. Please start Ollama / START-SYSTEM.bat or type the remark manually.",
        )
    return ai.write_polite_remark(data.raw_remark, data.chosen_field)


# MINOR: Also serve the website directly if opened from http://127.0.0.1:8001/
WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web"))
if os.path.isdir(WEB_DIR):
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")

