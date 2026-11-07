"""
PIGEM Web-Based Internet Service Application System
Customer Email Notification Module - Powered by Gmail SMTP (Python smtplib)

Rules:
- Emails are sent EXCLUSIVELY to verified @gmail.com Customer accounts.
- Internal Agent, Manager, and Admin business accounts (@pigem.com) never receive
  external emails; internal status coordination uses in-system website notifications.
- Clean, lightweight, professional card layout compliant with Republic Act No. 10173.
"""

import html
import os
import re
import smtplib
import ssl
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid, parseaddr
from typing import Any, Dict, List, Optional

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

_ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")

COMPANY_NAME = "PIGEM Combined Facilities Support Services"
BRAND_RED = "#c8102e"
BRAND_DARK = "#101828"
BRAND_BORDER = "#e2e8f0"
OFFICE_LINE = "Dasmari\u00f1as City, Cavite | Tel: (046) 458-0908 | Hotline: 101-733 (RED)"
LIVE_BASE_URL = "https://pigem-system-web.vercel.app"

_GMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@gmail\.com$", re.IGNORECASE)


def _reload_env() -> None:
    """Load local api/.env when present; on Vercel Cloud, variables come from os.environ."""
    if load_dotenv is not None and os.path.exists(_ENV_FILE):
        load_dotenv(_ENV_FILE, override=True)


def _get_app_base_url() -> str:
    """Return the live application base URL from APP_BASE_URL or the default Vercel domain."""
    _reload_env()
    return (os.getenv("APP_BASE_URL") or LIVE_BASE_URL).strip().rstrip("/")


def _resolve_customer_portal_link(raw_link: str = "") -> str:
    """Return the Customer Portal URL."""
    clean = (raw_link or "").strip()
    if clean:
        return clean
    return _get_app_base_url() + "/customer.html"


def _escape(val: Any) -> str:
    """HTML-escape untrusted values safely."""
    if val is None:
        return ""
    return html.escape(str(val))


def is_customer_gmail(email_addr: str) -> bool:
    """Return True strictly for valid @gmail.com customer addresses."""
    return bool(_GMAIL_REGEX.match((email_addr or "").strip()))


def _get_smtp_config() -> Dict[str, Any]:
    """Read Gmail SMTP credentials from environment variables."""
    _reload_env()
    host = (os.getenv("SMTP_HOST") or "smtp.gmail.com").strip()
    try:
        port = int((os.getenv("SMTP_PORT") or "587").strip())
    except ValueError:
        port = 587
    user = (os.getenv("SMTP_USER") or "").strip()
    password = (os.getenv("SMTP_PASSWORD") or "").replace(" ", "").strip()
    raw_from = (os.getenv("SMTP_FROM") or "").strip()
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "raw_from": raw_from,
    }


def is_configured() -> bool:
    """Return True when SMTP_USER and SMTP_PASSWORD are set."""
    cfg = _get_smtp_config()
    user = cfg["user"]
    pw = cfg["password"]
    if not user or not pw:
        return False
    placeholders = {
        "your_email@gmail.com",
        "yourgmail@gmail.com",
        "your_16_char_app_password",
        "xxxx",
    }
    return user.lower() not in placeholders and pw.lower() not in placeholders


class BaseEmailTemplateRenderer:
    """Abstract base renderer providing a clean, lightweight, professional card layout."""

    def wrap_card(self, title: str, greeting_name: str, body_html: str, action_label: str = "", action_url: str = "") -> str:
        safe_title = _escape(title)
        safe_name = _escape(greeting_name or "Valued Customer")
        button_block = ""
        if action_label and action_url:
            button_block = (
                f'<div style="margin:22px 0 8px 0;">'
                f'<a href="{_escape(action_url)}" style="display:inline-block;background:{BRAND_RED};color:#ffffff;'
                f'text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:6px;">'
                f'{_escape(action_label)}</a></div>'
            )

        return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{safe_title}</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:{BRAND_DARK};line-height:1.55;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;width:100%;background:#ffffff;border:1px solid {BRAND_BORDER};border-top:4px solid {BRAND_RED};border-radius:8px;">
          <tr>
            <td style="padding:20px 24px 12px 24px;border-bottom:1px solid #f1f5f9;">
              <div style="font-size:15px;font-weight:700;color:{BRAND_DARK};">{COMPANY_NAME}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">Authorized Red Fiber Service Partner</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px;">
              <div style="font-size:17px;font-weight:700;color:{BRAND_DARK};margin-bottom:12px;">{safe_title}</div>
              <p style="font-size:14px;color:#334155;margin:0 0 12px 0;">Hello <b>{safe_name}</b>,</p>
              <div style="font-size:14px;color:#334155;">{body_html}</div>
              {button_block}
              <p style="font-size:13px;color:#64748b;margin:20px 0 0 0;">Thank you,<br><b>{COMPANY_NAME}</b></p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid {BRAND_BORDER};font-size:11.5px;color:#64748b;">
              <div>{OFFICE_LINE}</div>
              <div style="margin-top:4px;">Protected under Republic Act No. 10173 (Data Privacy Act of 2012). Please do not reply to this automated email.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


class CustomerEmailRenderer(BaseEmailTemplateRenderer):
    """Concrete renderer for all five Customer-only email notifications."""

    def render_otp(self, code: str, recipient_name: str, purpose: str) -> str:
        body = (
            f"<p style='margin:0 0 14px 0;'>Use the 6-digit verification code below to complete your <b>{_escape(purpose)}</b> request:</p>"
            f"<div style='background:#f8fafc;border:1px solid {BRAND_BORDER};border-radius:6px;padding:14px;text-align:center;margin:14px 0;'>"
            f"<span style='font-family:monospace;font-size:26px;font-weight:700;letter-spacing:6px;color:{BRAND_RED};'>{_escape(code)}</span>"
            f"<div style='font-size:12px;color:#64748b;margin-top:4px;'>Valid for 10 minutes. Do not share this code with anyone.</div>"
            f"</div>"
        )
        return self.wrap_card("Verification Code", recipient_name, body)

    def render_confirmation(
        self,
        ref_no: str,
        customer_name: str,
        plan_name: str,
        speed: str,
        price: str,
        address: str,
        activation_link: str,
        activation_code: str,
        is_existing_account: bool,
    ) -> str:
        portal_url = _resolve_customer_portal_link()
        if is_existing_account or not activation_code:
            note = "<p style='margin:12px 0 0 0;'>This application is linked to your existing Customer Account. Sign in anytime to check your status.</p>"
            cta_label = "Sign In to Customer Account"
            cta_url = portal_url
        else:
            note = (
                f"<p style='margin:12px 0 0 0;'>Activate your Customer Account using your one-time code "
                f"<b>{_escape(activation_code)}</b> to monitor your application online.</p>"
            )
            cta_label = "Activate Customer Account"
            cta_url = activation_link or portal_url

        body = (
            f"<p style='margin:0 0 12px 0;'>We have received your internet service application. Here is your summary:</p>"
            f"<div style='background:#f8fafc;border:1px solid {BRAND_BORDER};border-radius:6px;padding:12px 14px;font-size:13.5px;'>"
            f"<div><b>Reference Number:</b> <span style='color:{BRAND_RED};font-weight:700;'>{_escape(ref_no)}</span></div>"
            f"<div style='margin-top:4px;'><b>Selected Plan:</b> {_escape(plan_name)} ({_escape(speed)} - {_escape(price)}/mo)</div>"
            f"<div style='margin-top:4px;'><b>Service Address:</b> {_escape(address)}</div>"
            f"<div style='margin-top:4px;'><b>Status:</b> Processing</div>"
            f"</div>"
            f"{note}"
        )
        return self.wrap_card("Application Received", customer_name, body, cta_label, cta_url)

    def render_correction_notice(self, ref_no: str, customer_name: str, portal_link: str, target_summary: str) -> str:
        body = (
            f"<p style='margin:0 0 12px 0;'>Your application <b>{_escape(ref_no)}</b> requires a quick update before we can proceed.</p>"
            f"<div style='background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px 14px;font-size:13.5px;'>"
            f"<div><b>Update Requested:</b> {_escape(target_summary)}</div>"
            f"<div style='margin-top:4px;font-size:12.5px;color:#475569;'>For your privacy under RA 10173, please sign in to your Customer Account to view the note and submit your update.</div>"
            f"</div>"
        )
        return self.wrap_card(
            f"Update Needed - {ref_no}",
            customer_name,
            body,
            "Open Customer Account",
            _resolve_customer_portal_link(portal_link),
        )

    def render_status_update(self, ref_no: str, customer_name: str, status: str, remarks: str, portal_link: str) -> str:
        raw = (status or "").lower()
        if "approv" in raw:
            clean_status = "Approved"
            next_step = "Your application is approved. Please allow 3 to 5 business days for installation scheduling."
        elif "reject" in raw:
            clean_status = "Rejected"
            next_step = "Your application could not be completed at this time. Please check the remarks or contact our support desk."
        else:
            clean_status = "Processing"
            next_step = "Our team is actively processing your application."

        remarks_html = (
            f"<div style='margin-top:8px;'><b>Remarks:</b> {_escape(remarks)}</div>" if remarks else ""
        )
        body = (
            f"<p style='margin:0 0 12px 0;'>There is an update on your internet service application:</p>"
            f"<div style='background:#f8fafc;border:1px solid {BRAND_BORDER};border-radius:6px;padding:12px 14px;font-size:13.5px;'>"
            f"<div><b>Reference Number:</b> {_escape(ref_no)}</div>"
            f"<div style='margin-top:4px;'><b>Current Status:</b> {_escape(clean_status)}</div>"
            f"{remarks_html}"
            f"</div>"
            f"<p style='margin:12px 0 0 0;font-size:13.5px;'>{_escape(next_step)}</p>"
        )
        return self.wrap_card(
            f"Application Status: {clean_status}",
            customer_name,
            body,
            "View Application",
            _resolve_customer_portal_link(portal_link),
        )

    def render_promotional(
        self,
        customer_name: str,
        headline: str,
        body_text: str,
        promo_plans: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        plans_rows = ""
        if promo_plans:
            items = "".join(
                f"<li style='margin-bottom:4px;'><b>{_escape(p.get('name'))}</b> ({_escape(p.get('speed'))}) - {_escape(p.get('price'))}/month</li>"
                for p in promo_plans
            )
            plans_rows = f"<ul style='margin:12px 0;padding-left:18px;font-size:13.5px;'>{items}</ul>"

        formatted_body = _escape(body_text).replace("\n", "<br>")
        body = f"<p style='margin:0 0 10px 0;'>{formatted_body}</p>{plans_rows}"
        return self.wrap_card(
            headline or "PIGEM Service Announcement",
            customer_name,
            body,
            "View Plans & Offers",
            _get_app_base_url() + "/index.html",
        )

    def render_general(self, subject: str, message: str) -> str:
        body = f"<p style='margin:0;'>{_escape(message).replace(chr(10), '<br>')}</p>"
        return self.wrap_card(subject or "Notification", "Valued Customer", body)


_renderer = CustomerEmailRenderer()


def send(
    to: str,
    subject: str,
    message: str = "",
    html_content: Optional[str] = None,
    template_type: str = "general",
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send a clean HTML + plain-text email strictly to a @gmail.com Customer address via Gmail SMTP."""
    recipient = (to or "").strip().lower()
    if not recipient or "@" not in recipient:
        return {"sent": False, "reason": "Recipient email address is invalid or empty."}

    if not is_customer_gmail(recipient):
        return {
            "sent": False,
            "skipped_internal": True,
            "reason": "Email notifications are sent exclusively to @gmail.com Customer accounts. Internal business accounts receive in-system website notifications.",
        }

    if not is_configured():
        return {
            "sent": False,
            "unconfigured": True,
            "reason": "Gmail SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in environment variables.",
        }

    cfg = _get_smtp_config()
    smtp_host = cfg["host"]
    smtp_port = cfg["port"]
    smtp_user = cfg["user"]
    smtp_pass = cfg["password"]
    raw_from = cfg["raw_from"]

    payload = payload or {}
    final_html = html_content

    if not final_html:
        lowered_subj = (subject or "").lower()
        if template_type == "otp" or "otp" in lowered_subj or "verification code" in lowered_subj:
            code_match = re.search(r"\b(\d{6})\b", message) or re.search(r"\b(\d{6})\b", subject or "")
            extracted_code = payload.get("code") or (code_match.group(1) if code_match else "000000")
            final_html = _renderer.render_otp(
                code=str(extracted_code),
                recipient_name=payload.get("customer_name") or payload.get("full_name") or "Valued Customer",
                purpose=payload.get("purpose") or "Verification",
            )
        elif template_type == "application_confirmation" or "application confirmation" in lowered_subj:
            final_html = _renderer.render_confirmation(
                ref_no=payload.get("ref_no") or "PENDING",
                customer_name=payload.get("customer_name") or payload.get("full_name") or "Applicant",
                plan_name=payload.get("plan_name") or "Red Fiber Plan",
                speed=payload.get("speed") or "100 Mbps",
                price=payload.get("price") or "Php 1,000",
                address=payload.get("address") or "Dasmari\u00f1as City, Cavite",
                activation_link=payload.get("activation_link") or "",
                activation_code=payload.get("activation_code") or "",
                is_existing_account=bool(payload.get("is_existing_account")),
            )
        elif template_type == "correction_notice" or "correction" in lowered_subj or "update needed" in lowered_subj:
            final_html = _renderer.render_correction_notice(
                ref_no=payload.get("ref_no") or "APPLICATION",
                customer_name=payload.get("customer_name") or payload.get("full_name") or "Customer",
                portal_link=payload.get("portal_link") or "",
                target_summary=payload.get("target_summary") or "Document or Information Update",
            )
        elif template_type == "status_update" or "application update" in lowered_subj:
            final_html = _renderer.render_status_update(
                ref_no=payload.get("ref_no") or "APPLICATION",
                customer_name=payload.get("customer_name") or payload.get("full_name") or "Customer",
                status=payload.get("status") or "Processing",
                remarks=payload.get("remarks") or message,
                portal_link=payload.get("portal_link") or "",
            )
        elif template_type == "promotional":
            final_html = _renderer.render_promotional(
                customer_name=payload.get("customer_name") or "Valued Subscriber",
                headline=payload.get("headline") or subject,
                body_text=payload.get("body") or message,
                promo_plans=payload.get("promo_plans"),
            )
        else:
            final_html = _renderer.render_general(subject, message)

    display_name = COMPANY_NAME
    if raw_from:
        parsed_name, _ = parseaddr(raw_from)
        if parsed_name:
            display_name = parsed_name

    plain_fallback = (message or "").strip() or f"{subject}\n\n{COMPANY_NAME}\n{OFFICE_LINE}"
    msg_id = make_msgid(domain="gmail.com")

    mime_msg = MIMEMultipart("alternative")
    mime_msg["From"] = formataddr((display_name, smtp_user))
    mime_msg["To"] = recipient
    mime_msg["Subject"] = Header(subject or "PIGEM Notification", "utf-8")
    mime_msg["Date"] = formatdate(localtime=True)
    mime_msg["Message-ID"] = msg_id

    mime_msg.attach(MIMEText(plain_fallback, "plain", "utf-8"))
    mime_msg.attach(MIMEText(final_html, "html", "utf-8"))

    try:
        ssl_ctx = ssl.create_default_context()
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20, context=ssl_ctx) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [recipient], mime_msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.ehlo()
                server.starttls(context=ssl_ctx)
                server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [recipient], mime_msg.as_string())

        return {
            "sent": True,
            "id": msg_id.strip("<>"),
            "provider": "gmail_smtp",
            "reason": "",
        }
    except smtplib.SMTPAuthenticationError:
        return {
            "sent": False,
            "reason": f"Gmail SMTP authentication failed for {smtp_user}. Verify that 2-Step Verification is active and SMTP_PASSWORD is a valid 16-character Google App Password.",
        }
    except Exception as error:
        return {"sent": False, "reason": str(error)}
