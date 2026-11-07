"""
================================================================================
FILE: api/_mailer.py
PURPOSE:
  Customer Email Notification Module powered by Encrypted Gmail SMTP (`smtplib`).

CORE GOVERNANCE & PRIVACY RULES:
  1. Customer-Only Delivery (`@gmail.com` Exclusivity): Emails are sent ONLY to
     verified `@gmail.com` Customer addresses. Internal business accounts
     (`@pigem.com` for Agent, Manager, and Admin) are automatically skipped
     because internal coordination uses in-system website notifications.
  2. Clean, Lightweight Professional Card UI: Renders a concise, mobile-friendly
     540px HTML card with top `#c8102e` brand accent and plain-text fallback.
  3. RA 10173 Data Privacy Compliance: Correction emails notify the Customer
     that an update is needed without exposing sensitive personal/ID data in
     email text, directing them to sign in to their Customer Account.
================================================================================
"""

# ------------------------------------------------------------------------------
# IMPORTS EXPLANATION (Why each library is imported in the cloud):
# ------------------------------------------------------------------------------
# `html` escapes user-provided strings (`<`, `>`, `&`) so names or addresses
# never break HTML email formatting or inject unsafe tags.
import html

# `getenv` (from Python's standard `os` module) reads `SMTP_HOST`, `SMTP_PORT`,
# `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `APP_BASE_URL` configured in
# the Vercel Cloud Environment Variables dashboard (`Config` & `Secret`).
from os import getenv

# `re` (Regular Expressions) enforces that recipient addresses match `@gmail.com`.
import re

# `smtplib` and `ssl` (standard Python libraries) open an encrypted STARTTLS
# connection to `smtp.gmail.com` on port `587` to send emails securely.
import smtplib
import ssl

# Standard `email.*` modules construct RFC-compliant multipart emails containing
# both a plain-text body and a styled HTML card body.
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid, parseaddr

# Standard type annotations for clean function signatures.
from typing import Any, Dict, List, Optional


# Brand & office constants displayed in the clean HTML card header and footer
COMPANY_NAME = "PIGEM Combined Facilities Support Services"
BRAND_RED = "#c8102e"
BRAND_DARK = "#101828"
BRAND_BORDER = "#e2e8f0"
OFFICE_LINE = "Dasmari\u00f1as City, Cavite | Tel: (046) 458-0908 | Hotline: 101-733 (RED)"
LIVE_BASE_URL = "https://pigem-system-web.vercel.app"

# Regular Expression matching strictly valid `@gmail.com` Customer email addresses
_GMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@gmail\.com$", re.IGNORECASE)


def _get_app_base_url() -> str:
    """Returns `APP_BASE_URL` from Vercel Cloud env or defaults to the live Vercel URL."""
    return (getenv("APP_BASE_URL") or LIVE_BASE_URL).strip().rstrip("/")


def _resolve_customer_portal_link(raw_link: str = "") -> str:
    """Returns a valid direct link to the Customer Portal (`customer.html`)."""
    clean = (raw_link or "").strip()
    if clean:
        return clean
    return _get_app_base_url() + "/customer.html"


def _escape(val: Any) -> str:
    """Safely HTML-escapes dynamic values before inserting into HTML templates."""
    if val is None:
        return ""
    return html.escape(str(val))


def is_customer_gmail(email_addr: str) -> bool:
    """Returns True strictly when `email_addr` ends with `@gmail.com`."""
    return bool(_GMAIL_REGEX.match((email_addr or "").strip()))


def _get_smtp_config() -> Dict[str, Any]:
    """Reads Gmail SMTP settings injected by Vercel Cloud Environment Variables."""
    host = (getenv("SMTP_HOST") or "smtp.gmail.com").strip()
    try:
        port = int((getenv("SMTP_PORT") or "587").strip())
    except ValueError:
        port = 587
    user = (getenv("SMTP_USER") or "").strip()
    # Strip spaces from 16-character Google App Passwords (`xxxx xxxx xxxx xxxx`)
    password = (getenv("SMTP_PASSWORD") or "").replace(" ", "").strip()
    raw_from = (getenv("SMTP_FROM") or "").strip()
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "raw_from": raw_from,
    }


def is_configured() -> bool:
    """Returns True when real `SMTP_USER` and `SMTP_PASSWORD` values exist in env."""
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


# ------------------------------------------------------------------------------
# BASE EMAIL CARD RENDERER (OOP Abstraction & Inheritance)
# ------------------------------------------------------------------------------
class BaseEmailTemplateRenderer:
    """
    Parent class providing the shared, lightweight 540px HTML card wrapper
    used by all Customer transactional and promotional email templates.
    """

    def wrap_card(
        self,
        title: str,
        greeting_name: str,
        body_html: str,
        action_label: str = "",
        action_url: str = "",
    ) -> str:
        """Wraps email content inside a clean, responsive corporate card."""
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


# ------------------------------------------------------------------------------
# CONCRETE CUSTOMER EMAIL RENDERER (OOP Inheritance)
# ------------------------------------------------------------------------------
class CustomerEmailRenderer(BaseEmailTemplateRenderer):
    """Renders all five Customer email types using clean, simple formatting."""

    def render_otp(self, code: str, recipient_name: str, purpose: str) -> str:
        """1. 6-Digit Security OTP (Contact Verification & Customer Password Recovery)."""
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
        """2. Application Reference Number & Customer Account Activation Notice."""
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
        """3. RA 10173 Privacy-Safe Correction Notice (no raw ID data exposed in email)."""
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
        """4. Application Status Update (`Approved`, `Rejected`, or `Processing`)."""
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
        """5. Promotional Service Announcement for opted-in `@gmail.com` Customers."""
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
        """Fallback general Customer email template."""
        body = f"<p style='margin:0;'>{_escape(message).replace(chr(10), '<br>')}</p>"
        return self.wrap_card(subject or "Notification", "Valued Customer", body)


_renderer = CustomerEmailRenderer()


# ------------------------------------------------------------------------------
# MAIN GMAIL SMTP TLS SENDER
# ------------------------------------------------------------------------------
def send(
    to: str,
    subject: str,
    message: str = "",
    html_content: Optional[str] = None,
    template_type: str = "general",
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Sends a clean multipart (Plain-Text + HTML) email via encrypted Gmail SMTP
    strictly to `@gmail.com` Customer accounts.
    """
    recipient = (to or "").strip().lower()
    if not recipient or "@" not in recipient:
        return {"sent": False, "reason": "Recipient email address is invalid or empty."}

    # Enforce Customer-only `@gmail.com` delivery; skip internal `@pigem.com` accounts
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
            "reason": "Gmail SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in Vercel Environment Variables.",
        }

    cfg = _get_smtp_config()
    data = payload or {}
    t_type = (template_type or "general").strip().lower()

    # Select the matching Customer HTML template if custom HTML was not passed
    if html_content:
        final_html = html_content
    elif t_type == "otp":
        final_html = _renderer.render_otp(
            code=str(data.get("code") or "000000"),
            recipient_name=str(data.get("customer_name") or "Valued Customer"),
            purpose=str(data.get("purpose") or "Account Verification"),
        )
    elif t_type == "application_confirmation":
        final_html = _renderer.render_confirmation(
            ref_no=str(data.get("ref_no") or "PIGEM-PENDING"),
            customer_name=str(data.get("customer_name") or "Valued Applicant"),
            plan_name=str(data.get("plan_name") or "Red Fiber Plan"),
            speed=str(data.get("speed") or "100 Mbps"),
            price=str(data.get("price") or "PHP 1,000"),
            address=str(data.get("address") or "Dasmari\u00f1as City, Cavite"),
            activation_link=str(data.get("activation_link") or ""),
            activation_code=str(data.get("activation_code") or ""),
            is_existing_account=bool(data.get("is_existing_account")),
        )
    elif t_type == "correction_notice":
        final_html = _renderer.render_correction_notice(
            ref_no=str(data.get("ref_no") or ""),
            customer_name=str(data.get("customer_name") or "Valued Customer"),
            portal_link=str(data.get("portal_link") or ""),
            target_summary=str(data.get("target_summary") or "Application Detail / ID Photo Update"),
        )
    elif t_type == "status_update":
        final_html = _renderer.render_status_update(
            ref_no=str(data.get("ref_no") or ""),
            customer_name=str(data.get("customer_name") or "Valued Customer"),
            status=str(data.get("status") or "Processing"),
            remarks=str(data.get("remarks") or ""),
            portal_link=str(data.get("portal_link") or ""),
        )
    elif t_type == "promotional":
        final_html = _renderer.render_promotional(
            customer_name=str(data.get("customer_name") or "Valued Subscriber"),
            headline=str(data.get("headline") or subject),
            body_text=str(data.get("body_text") or message),
            promo_plans=data.get("promo_plans"),
        )
    else:
        final_html = _renderer.render_general(subject=subject, message=message)

    plain_fallback = (message or subject or COMPANY_NAME).strip()

    # Format sender display name and email address cleanly
    display_name, parsed_addr = parseaddr(cfg["raw_from"])
    sender_addr = parsed_addr or cfg["user"]
    sender_name = display_name or COMPANY_NAME

    # Build standard multipart/alternative MIME message
    mime_msg = MIMEMultipart("alternative")
    mime_msg["Subject"] = Header(subject or "PIGEM Notification", "utf-8")
    mime_msg["From"] = formataddr((str(Header(sender_name, "utf-8")), sender_addr))
    mime_msg["To"] = recipient
    mime_msg["Date"] = formatdate(localtime=True)
    mime_msg["Message-ID"] = make_msgid(domain="gmail.com")

    mime_msg.attach(MIMEText(plain_fallback, "plain", "utf-8"))
    mime_msg.attach(MIMEText(final_html, "html", "utf-8"))

    # Connect to Gmail SMTP over encrypted TLS (Port 587 STARTTLS or Port 465 SSL)
    try:
        tls_context = ssl.create_default_context()
        if cfg["port"] == 465:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=20, context=tls_context) as server:
                server.login(cfg["user"], cfg["password"])
                server.sendmail(sender_addr, [recipient], mime_msg.as_string())
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as server:
                server.ehlo()
                server.starttls(context=tls_context)
                server.ehlo()
                server.login(cfg["user"], cfg["password"])
                server.sendmail(sender_addr, [recipient], mime_msg.as_string())

        return {"sent": True, "provider": "gmail_smtp", "to": recipient}
    except Exception as exc:
        return {"sent": False, "reason": f"Gmail SMTP error: {exc}"}
