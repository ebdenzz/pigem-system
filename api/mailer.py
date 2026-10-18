"""
Email sending with Resend.

MAJOR: Only application emails go through here (reference, correction, status updates).
Sign-up verification and password reset emails are sent by Supabase Authentication.
"""
import html
import os

import httpx


def is_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY"))


def send(to: str, subject: str, message: str):
    """MAJOR: Send one email. Never crashes the website if email fails."""
    if not is_configured():
        print("[email skipped - no RESEND_API_KEY]", to, subject)
        return {"sent": False, "reason": "RESEND_API_KEY is missing."}

    # MINOR: escape the text so it is safe inside the email HTML
    body = "<p>" + html.escape(message).replace("\n", "<br>") + "</p>"
    try:
        reply = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": "Bearer " + os.getenv("RESEND_API_KEY")},
            json={"from": os.getenv("RESEND_FROM", "PIGEM <onboarding@resend.dev>"),
                  "to": [to], "subject": subject, "html": body},
            timeout=15,
        )
        return {"sent": reply.status_code < 300, "reason": "" if reply.status_code < 300 else reply.text}
    except Exception as error:
        return {"sent": False, "reason": str(error)}
