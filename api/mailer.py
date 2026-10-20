"""
Email sending with Resend — Professional Corporate Business Email Template.

MAJOR: Formats all application, verification, and status update emails into a formal
corporate HTML email from PIGEM Combined Facilities Support Services.
"""
import html
import os

import httpx


def is_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY"))


def build_business_html(subject: str, message: str) -> str:
    safe_subject = html.escape(subject or "Official Notification")
    safe_body = html.escape(message or "").replace("\n", "<br>")
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin:0;padding:24px;background-color:#f4f6f8;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d2939;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e4e7ec;border-radius:10px;overflow:hidden;">
    <tr>
      <td style="background:#c8102e;color:#ffffff;padding:20px 26px;">
        <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;font-weight:600;">Official Business Communication</div>
        <div style="font-size:19px;font-weight:700;margin-top:4px;">PIGEM — Combined Facilities Support Services</div>
      </td>
    </tr>
    <tr>
      <td style="padding:26px;">
        <div style="font-size:16px;font-weight:700;color:#101828;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #eaecf0;">
          {safe_subject}
        </div>
        <div style="font-size:14.5px;line-height:1.65;color:#344054;">
          {safe_body}
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb;border-top:1px solid #eaecf0;padding:16px 26px;font-size:12px;color:#667085;line-height:1.5;">
        <b>Combined Facilities Support Services (PIGEM)</b><br>
        Blk 42 Lot 19 Tokya St., Summerwind Village M., Brgy. Burol Main, Dasmariñas City, Cavite<br>
        Tel: (046) 458-0908 &bull; Hotline: 101-733 (RED) / (02) 8899-9733<br>
        <span style="color:#98a2b3;">This is an automated official notification. Please keep this email for your records.</span>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send(to: str, subject: str, message: str):
    """MAJOR: Send one formal business email. Never crashes the website if email fails."""
    if not is_configured():
        print("[email skipped - no RESEND_API_KEY]", to, subject)
        return {"sent": False, "reason": "RESEND_API_KEY is missing."}

    body = build_business_html(subject, message)
    try:
        reply = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": "Bearer " + os.getenv("RESEND_API_KEY")},
            json={
                "from": os.getenv("RESEND_FROM", "PIGEM Support Services <onboarding@resend.dev>"),
                "to": [to],
                "subject": subject,
                "html": body,
            },
            timeout=15,
        )
        return {"sent": reply.status_code < 300, "reason": "" if reply.status_code < 300 else reply.text}
    except Exception as error:
        return {"sent": False, "reason": str(error)}
