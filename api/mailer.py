"""
PIGEM Web-Based Internet Service Application System
Email Notification Module — Powered by Resend (https://resend.com)

Combined Facilities Support Services (PIGEM)
Dasmariñas City, Cavite, Philippines

Compliant with:
- Republic Act No. 10173 (Data Privacy Act of 2012)
- Enterprise Email Formatting Guidelines (Multi-client HTML: Gmail, Apple Mail, Outlook)
- Red Fiber / PIGEM Corporate Brand Identity
"""

import html
import os
import re
from typing import Any, Dict, List, Optional
import httpx

# Corporate Constants
COMPANY_NAME = "PIGEM Combined Facilities Support Services"
COMPANY_SHORT = "PIGEM"
BRAND_RED = "#c8102e"
BRAND_DARK = "#101828"
BRAND_MUTED = "#475467"
BRAND_BG = "#f4f6f8"
BRAND_CARD = "#ffffff"
BRAND_BORDER = "#e4e7ec"

OFFICE_ADDRESS = "Blk 42 Lot 19 Tokya St., Summerwind Village M., Brgy. Burol Main, Dasmariñas City, Cavite"
TELEPHONE = "(046) 458-0908"
HOTLINE = "101-733 (RED) / (02) 8899-9733"
DEFAULT_PORTAL_URL = "https://pigem-system-web.vercel.app/customer.html"
DEFAULT_AGENT_URL = "https://pigem-system-web.vercel.app/agent.html"
DEFAULT_MANAGER_URL = "https://pigem-system-web.vercel.app/manager.html"


def is_configured() -> bool:
    """Returns True if Resend API key is available in environment."""
    return bool(os.getenv("RESEND_API_KEY"))


def _escape(val: Any) -> str:
    """HTML-safe escaping for user inputs."""
    if val is None:
        return ""
    return html.escape(str(val))


def _clean_text(val: Any) -> str:
    """Strip dangerous characters or extra whitespace."""
    if not val:
        return ""
    return str(val).strip()


def _wrap_email_layout(
    subject: str,
    preheader: str,
    content_html: str,
    accent_color: str = BRAND_RED,
    badge_text: str = "Official Communication",
    unsubscribe_url: Optional[str] = None,
) -> str:
    """
    Standard corporate email frame:
    - Preheader (hidden in body, visible in inbox summary)
    - Branded corporate header with PIGEM emblem & title
    - Elevated content card
    - Comprehensive legal & Data Privacy Act (RA 10173) compliance footer
    """
    safe_subject = _escape(subject)
    safe_preheader = _escape(preheader or subject)
    safe_badge = _escape(badge_text)

    unsub_html = ""
    if unsubscribe_url:
        unsub_html = f"""
        <div style="margin-top:12px;padding-top:12px;border-top:1px dashed #e4e7ec;font-size:11px;color:#98a2b3;">
          You are receiving this communication based on your marketing preferences.
          <a href="{_escape(unsubscribe_url)}" style="color:#c8102e;text-decoration:underline;margin-left:4px;">Unsubscribe / Manage Preferences</a>
        </div>
        """

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{safe_subject}</title>
  <style>
    body, table, td, p, a, li, blockquote {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
    table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
    img {{ -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }}
    @media only screen and (max-width: 620px) {{
      .email-container {{ width: 100% !important; margin: 0 !important; }}
      .mobile-padding {{ padding: 20px 16px !important; }}
      .stack-column {{ display: block !important; width: 100% !important; box-sizing: border-box !important; }}
      .otp-digit {{ font-size: 26px !important; letter-spacing: 4px !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:24px 12px;background-color:{BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:{BRAND_DARK};line-height:1.55;">

  <!-- Preheader text (appears in mail inbox preview) -->
  <div style="display:none;font-size:1px;color:{BRAND_BG};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    {safe_preheader} &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{BRAND_BG};">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:{BRAND_CARD};border:1px solid {BRAND_BORDER};border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(16,24,40,0.04);">
          
          <!-- Corporate Header -->
          <tr>
            <td style="background-color:{accent_color};padding:22px 28px;color:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);margin-bottom:4px;">
                      {safe_badge}
                    </div>
                    <div style="font-size:20px;font-weight:800;letter-spacing:-0.01em;color:#ffffff;line-height:1.2;">
                      {COMPANY_SHORT} &bull; Combined Facilities Support Services
                    </div>
                    <div style="font-size:12px;font-weight:500;color:rgba(255,255,255,0.9);margin-top:2px;">
                      Authorized Partner for Red Fiber Internet &bull; Dasmari\u00f1as City, Cavite
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td class="mobile-padding" style="padding:32px 28px 24px 28px;background-color:#ffffff;">
              {content_html}
            </td>
          </tr>

          <!-- Corporate Footer -->
          <tr>
            <td class="mobile-padding" style="background-color:#fafbfc;border-top:1px solid {BRAND_BORDER};padding:22px 28px;font-size:12px;color:{BRAND_MUTED};line-height:1.6;">
              <div style="font-weight:700;color:{BRAND_DARK};font-size:12.5px;margin-bottom:4px;">
                {COMPANY_NAME}
              </div>
              <div>{OFFICE_ADDRESS}</div>
              <div style="margin-top:4px;">
                <b>Tel:</b> {TELEPHONE} &nbsp;&bull;&nbsp; <b>24/7 Hotline:</b> {HOTLINE}
              </div>

              <!-- Data Privacy Notice (RA 10173) -->
              <div style="margin-top:12px;padding-top:12px;border-top:1px solid #eaecf0;font-size:11px;color:#667085;line-height:1.5;">
                <b>Confidentiality & Data Privacy Notice:</b> This communication and any attachments are intended solely for the designated recipient and may contain confidential information protected under Republic Act No. 10173 (Data Privacy Act of 2012). If you received this transmission in error, please notify the sender immediately and delete this message.
              </div>
              <div style="margin-top:6px;font-size:10.5px;color:#98a2b3;">
                This is an automated system notification. Please do not reply directly to this email address.
              </div>
              {unsub_html}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>"""


# ==============================================================================
# 1. CUSTOMER: OTP Verification Email (Contact, Registration, Password Reset)
# ==============================================================================
def build_otp_html(
    code: str,
    recipient_name: str = "Valued Applicant",
    purpose: str = "Contact Verification",
    expiry_minutes: int = 10,
) -> str:
    """
    Renders an executive security OTP card with large letter-spaced 6-digit code,
    timer notice, and security fraud prevention disclaimer.
    """
    safe_code = _escape(code)
    safe_name = _escape(recipient_name or "Valued Client")
    safe_purpose = _escape(purpose)
    subject = f"PIGEM Account Security — Your {purpose} Code is {code}"
    preheader = f"Your 6-digit verification code is {code}. It expires in {expiry_minutes} minutes."

    content = f"""
    <div style="margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;color:{BRAND_RED};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
        Identity &amp; Security Verification
      </div>
      <h1 style="font-size:22px;font-weight:800;color:{BRAND_DARK};margin:0 0 12px 0;line-height:1.25;">
        One-Time Verification Code (OTP)
      </h1>
      <p style="font-size:14.5px;color:#344054;margin:0 0 16px 0;">
        Dear <b>{safe_name}</b>,
      </p>
      <p style="font-size:14px;color:#475467;margin:0 0 20px 0;line-height:1.6;">
        We received a request for <b>{safe_purpose}</b> regarding your PIGEM Internet Service Application. Please enter the one-time verification code below into your screen to authenticate your request:
      </p>
    </div>

    <!-- OTP Code Display Box -->
    <div style="background:linear-gradient(180deg,#fff5f5 0%,#fef2f2 100%);border:2px dashed #fecdca;border-radius:12px;padding:24px 16px;text-align:center;margin:24px 0;">
      <div style="font-size:12px;font-weight:700;color:#b42318;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">
        Your 6-Digit Verification Code
      </div>
      <div class="otp-digit" style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:900;letter-spacing:8px;color:#b42318;padding:6px 0;">
        {safe_code}
      </div>
      <div style="display:inline-block;margin-top:10px;background:#ffffff;border:1px solid #fecdca;border-radius:20px;padding:4px 14px;font-size:11.5px;color:#b42318;font-weight:600;">
        Valid for {expiry_minutes} minutes &bull; Single-use only
      </div>
    </div>

    <!-- Security Advisory Box -->
    <div style="background:#f8f9fa;border-left:4px solid #f04438;border-radius:6px;padding:14px 16px;margin:22px 0;font-size:12.5px;color:#344054;line-height:1.55;">
      <div style="font-weight:700;color:#101828;margin-bottom:3px;display:flex;align-items:center;">
        &#9888; Security &amp; Anti-Fraud Warning
      </div>
      PIGEM staff, agents, and customer service representatives will <b>never</b> call or message you asking for your 6-digit OTP. Never share this code with anyone. If you did not initiate this request, please disregard this email or report it to our security desk immediately.
    </div>

    <p style="font-size:13px;color:#667085;margin:20px 0 0 0;">
      Thank you for helping us keep your account safe and secure.<br>
      <b>Customer Verification &amp; Security Team</b><br>
      {COMPANY_NAME}
    </p>
    """

    return _wrap_email_layout(
        subject=subject,
        preheader=preheader,
        content_html=content,
        accent_color=BRAND_RED,
        badge_text="Security Verification",
    )


# ==============================================================================
# 2. CUSTOMER: Application Reference & Confirmation Email
# ==============================================================================
def build_application_confirmation_html(
    ref_no: str,
    customer_name: str,
    plan_name: str,
    speed: str,
    price: str,
    address: str,
    activation_link: str = "",
    activation_code: str = "",
    is_existing_account: bool = False,
    portal_link: str = DEFAULT_PORTAL_URL,
) -> str:
    """
    Renders the official application confirmation email with Reference Number,
    plan breakdown, address, next steps, and account activation instructions.
    """
    safe_ref = _escape(ref_no)
    safe_name = _escape(customer_name or "Subscriber")
    safe_plan = _escape(plan_name)
    safe_speed = _escape(speed)
    safe_price = _escape(price)
    safe_addr = _escape(address)
    subject = f"PIGEM Application Confirmation — Reference No. {ref_no}"
    preheader = f"Your application {ref_no} for {plan_name} has been received and is under verification."

    # Activation Block vs Existing Account Block
    if is_existing_account or not activation_code:
        account_section = f"""
        <div style="background:#eff8ff;border:1px solid #b2ddff;border-radius:8px;padding:16px 18px;margin:20px 0;">
          <div style="font-size:13px;font-weight:700;color:#175cd3;margin-bottom:4px;">
            Linked to Your Existing Customer Portal Account
          </div>
          <div style="font-size:13px;color:#1849a9;line-height:1.5;">
            This application has been successfully linked to your existing subscriber profile. You can sign in anytime to monitor processing and dispatch status in real time.
          </div>
          <div style="margin-top:12px;">
            <a href="{_escape(portal_link)}" style="display:inline-block;background:#175cd3;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:8px 18px;border-radius:6px;">
              Open Customer Portal &rarr;
            </a>
          </div>
        </div>
        """
    else:
        account_section = f"""
        <div style="background:#fef6ee;border:1px solid #f9dbaf;border-radius:8px;padding:18px 20px;margin:22px 0;">
          <div style="font-size:13px;font-weight:700;color:#b54708;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">
            Account Activation Required
          </div>
          <div style="font-size:14px;font-weight:700;color:#101828;margin-bottom:6px;">
            Activate Your Customer Portal Account
          </div>
          <div style="font-size:13px;color:#344054;line-height:1.5;margin-bottom:12px;">
            To track your application, view document screening remarks, and manage your internet service, please activate your account using your one-time code:
          </div>
          <div style="text-align:center;background:#ffffff;border:1px dashed #f79009;border-radius:8px;padding:12px;margin:10px 0 14px 0;">
            <span style="font-size:11px;color:#667085;text-transform:uppercase;display:block;margin-bottom:2px;">One-Time Activation Code</span>
            <span style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:800;color:#b54708;letter-spacing:4px;">{_escape(activation_code)}</span>
          </div>
          <div style="text-align:center;margin-top:14px;">
            <a href="{_escape(activation_link)}" style="display:inline-block;background:{BRAND_RED};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 26px;border-radius:6px;box-shadow:0 2px 4px rgba(200,16,46,0.2);">
              Activate My Account Now &rarr;
            </a>
          </div>
        </div>
        """

    content = f"""
    <div>
      <div style="font-size:12px;font-weight:700;color:{BRAND_RED};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
        Application Received &bull; Under Processing
      </div>
      <h1 style="font-size:22px;font-weight:800;color:{BRAND_DARK};margin:0 0 12px 0;line-height:1.25;">
        Thank You for Applying with PIGEM
      </h1>
      <p style="font-size:14.5px;color:#344054;margin:0 0 16px 0;">
        Dear <b>{safe_name}</b>,
      </p>
      <p style="font-size:14px;color:#475467;margin:0 0 20px 0;line-height:1.6;">
        We have successfully received your application for high-speed fiber internet. Your official reference number has been generated and assigned to our verification team.
      </p>

      <!-- Reference Card -->
      <div style="background:#ffffff;border:2px solid {BRAND_RED};border-radius:10px;padding:18px 20px;margin:20px 0;text-align:center;">
        <div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">
          Official Application Reference Number
        </div>
        <div style="font-size:26px;font-weight:900;color:{BRAND_RED};letter-spacing:2px;margin:6px 0;">
          {safe_ref}
        </div>
        <div style="font-size:12px;color:#475467;">
          Please retain this reference number for all inquiries and follow-ups.
        </div>
      </div>

      <!-- Application Details Table -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #eaecf0;border-radius:8px;overflow:hidden;margin:20px 0;font-size:13px;">
        <tr style="background:#f9fafb;">
          <th colspan="2" style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#344054;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #eaecf0;">
            Application Summary
          </th>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#667085;border-bottom:1px solid #eaecf0;width:35%;font-weight:600;">Selected Plan</td>
          <td style="padding:10px 14px;color:#101828;border-bottom:1px solid #eaecf0;font-weight:700;">{safe_plan} &bull; {safe_speed}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#667085;border-bottom:1px solid #eaecf0;font-weight:600;">Monthly Subscription</td>
          <td style="padding:10px 14px;color:#101828;border-bottom:1px solid #eaecf0;">{safe_price} / month</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#667085;border-bottom:1px solid #eaecf0;font-weight:600;">Installation Address</td>
          <td style="padding:10px 14px;color:#101828;border-bottom:1px solid #eaecf0;">{safe_addr}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#667085;font-weight:600;">Current Stage</td>
          <td style="padding:10px 14px;color:#b54708;font-weight:700;">Under Verification (Agent Document Review)</td>
        </tr>
      </table>

      {account_section}

      <!-- Next Steps -->
      <div style="margin:24px 0 16px 0;">
        <div style="font-size:13px;font-weight:700;color:#101828;margin-bottom:8px;">
          What Happens Next?
        </div>
        <ol style="margin:0;padding-left:20px;font-size:13px;color:#475467;line-height:1.7;">
          <li><b>Document Verification:</b> Our verification agent will inspect your submitted government ID and proof of billing within 24 to 48 hours.</li>
          <li><b>Barangay Facility Check:</b> We verify fiber port availability at your specific address in Dasmari\u00f1as City.</li>
          <li><b>Provider Encoding &amp; Dispatch:</b> Once approved, your order is encoded to the provider system and an installation crew is scheduled (standard 3 to 5 business days).</li>
        </ol>
      </div>

      <p style="font-size:13px;color:#667085;margin:24px 0 0 0;">
        Sincerely,<br>
        <b>Customer Onboarding &amp; Processing Desk</b><br>
        {COMPANY_NAME}
      </p>
    </div>
    """

    return _wrap_email_layout(
        subject=subject,
        preheader=preheader,
        content_html=content,
        accent_color=BRAND_RED,
        badge_text="Application Confirmation",
    )


# ==============================================================================
# 3. CUSTOMER: Agent-Confirmed Correction Notice (Strict RA 10173 Compliance)
# ==============================================================================
def build_correction_notice_html(
    ref_no: str,
    customer_name: str,
    portal_link: str = DEFAULT_PORTAL_URL,
    target_summary: str = "Document or Information Clarification",
) -> str:
    """
    Renders an agent-confirmed correction notice.
    PRIVACY COMPLIANCE (RA 10173):
    Does NOT expose raw personal details or ID numbers in email body.
    Directs the customer to the authenticated portal to review and fix.
    """
    safe_ref = _escape(ref_no)
    safe_name = _escape(customer_name or "Subscriber")
    safe_target = _escape(target_summary)
    safe_portal = _escape(portal_link)
    subject = f"PIGEM Action Required — Update Needed for Reference No. {ref_no}"
    preheader = f"Action required on application {ref_no}. Please log in to your authenticated portal to submit updates."

    content = f"""
    <div>
      <div style="font-size:12px;font-weight:700;color:#b54708;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
        Action Required &bull; Application Update Needed
      </div>
      <h1 style="font-size:22px;font-weight:800;color:{BRAND_DARK};margin:0 0 12px 0;line-height:1.25;">
        Correction Requested for Application {safe_ref}
      </h1>
      <p style="font-size:14.5px;color:#344054;margin:0 0 16px 0;">
        Dear <b>{safe_name}</b>,
      </p>
      <p style="font-size:14px;color:#475467;margin:0 0 18px 0;line-height:1.6;">
        Our customer verification team reviewed your Red Fiber Internet Service Application (<b>{safe_ref}</b>) and determined that an update or clarification is required before we can proceed with facility encoding.
      </p>

      <!-- Alert Box -->
      <div style="background:#fffcf5;border:1px solid #fecdca;border-left:5px solid #d92d20;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <div style="font-size:12px;font-weight:700;color:#b42318;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">
          Verification Status
        </div>
        <div style="font-size:16px;font-weight:800;color:#912018;margin-bottom:6px;">
          Correction Required ({safe_target})
        </div>
        <div style="font-size:13px;color:#475467;line-height:1.55;">
          To safeguard your privacy in accordance with <b>Republic Act No. 10173 (Data Privacy Act of 2012)</b>, specific sensitive details and document inspection remarks are not transmitted via open email.
        </div>
      </div>

      <!-- Action Instructions -->
      <div style="background:#f9fafb;border:1px solid #eaecf0;border-radius:8px;padding:18px 20px;margin:20px 0;">
        <div style="font-size:13px;font-weight:700;color:#101828;margin-bottom:10px;">
          How to Submit Your Corrections:
        </div>
        <ol style="margin:0;padding-left:20px;font-size:13px;color:#475467;line-height:1.75;">
          <li>Click the button below to sign in to your secure <b>PIGEM Customer Portal</b>.</li>
          <li>Locate application <b>{safe_ref}</b> and review the specific agent notes and highlighted fields.</li>
          <li>Upload replacement documents or update the requested fields.</li>
          <li>Submit your changes. The system will automatically return your application to <b>Processing</b> status for prompt re-evaluation.</li>
        </ol>
      </div>

      <!-- Direct Call to Action Button -->
      <div style="text-align:center;margin:28px 0;">
        <a href="{safe_portal}" style="display:inline-block;background:{BRAND_RED};color:#ffffff;text-decoration:none;font-size:14.5px;font-weight:700;padding:12px 30px;border-radius:6px;box-shadow:0 2px 6px rgba(200,16,46,0.25);">
          Log In &amp; Review Application &rarr;
        </a>
      </div>

      <p style="font-size:13px;color:#667085;margin:24px 0 0 0;">
        If you have already submitted your update, no further action is needed at this time.<br><br>
        Sincerely,<br>
        <b>Application Review &amp; Quality Desk</b><br>
        {COMPANY_NAME}
      </p>
    </div>
    """

    return _wrap_email_layout(
        subject=subject,
        preheader=preheader,
        content_html=content,
        accent_color="#d92d20",
        badge_text="Correction Required",
    )


# ==============================================================================
# 4. CUSTOMER: Status Update (Approved, Encoded to Provider, Rejected, etc.)
# ==============================================================================
def build_status_update_html(
    ref_no: str,
    customer_name: str,
    new_status: str,
    remarks: str = "",
    portal_link: str = DEFAULT_PORTAL_URL,
) -> str:
    """
    Renders official status updates with distinct badge coloring and next-step guides.
    """
    safe_ref = _escape(ref_no)
    safe_name = _escape(customer_name or "Subscriber")
    safe_status = _escape(new_status)
    safe_remarks = _escape(remarks)
    safe_portal = _escape(portal_link)
    subject = f"PIGEM Application Update — Reference No. {ref_no} [{new_status}]"
    preheader = f"Your application {ref_no} is now marked as {new_status}."

    status_lower = (new_status or "").lower()
    if "approved" in status_lower or "encoded" in status_lower:
        badge_bg = "#ecfdf3"
        badge_border = "#a6f4c5"
        badge_color = "#027a48"
        accent = "#027a48"
        guide_headline = "Facility Provisioning & Installation Schedule"
        guide_text = "Your application documents and service coverage have been verified. Our technical operations team has encoded your order to the telecom provider network. An authorized installation crew will contact you within 3 to 5 business days to confirm dispatch."
    elif "correction" in status_lower or "needs" in status_lower:
        badge_bg = "#fffcf5"
        badge_border = "#fecdca"
        badge_color = "#b42318"
        accent = "#d92d20"
        guide_headline = "Clarification / Action Required"
        guide_text = "Our agent requested an update regarding your application details or submitted files. Please sign in to the Customer Portal to update your application."
    elif "reject" in status_lower:
        badge_bg = "#fef3f2"
        badge_border = "#fee4e2"
        badge_color = "#b42318"
        accent = "#b42318"
        guide_headline = "Application Decision Notice"
        guide_text = "Following our verification and facility assessment, this application cannot be completed at this time due to facility limitations or eligibility criteria. You may contact our support hotline for further details."
    else:
        badge_bg = "#eff8ff"
        badge_border = "#b2ddff"
        badge_color = "#175cd3"
        accent = "#175cd3"
        guide_headline = "Application Under Active Review"
        guide_text = "Our verification specialists are actively processing your application. We will notify you immediately once the next milestone is reached."

    remarks_block = ""
    if safe_remarks:
        remarks_block = f"""
        <div style="background:#f9fafb;border-left:4px solid {accent};border-radius:4px;padding:12px 16px;margin:18px 0;font-size:13px;color:#344054;">
          <div style="font-weight:700;color:#101828;margin-bottom:4px;">Official Agent Remarks:</div>
          <div style="white-space:pre-wrap;line-height:1.5;">{safe_remarks}</div>
        </div>
        """

    content = f"""
    <div>
      <div style="font-size:12px;font-weight:700;color:{accent};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
        Official Status Notification
      </div>
      <h1 style="font-size:22px;font-weight:800;color:{BRAND_DARK};margin:0 0 12px 0;line-height:1.25;">
        Application Status Update
      </h1>
      <p style="font-size:14.5px;color:#344054;margin:0 0 16px 0;">
        Dear <b>{safe_name}</b>,
      </p>
      <p style="font-size:14px;color:#475467;margin:0 0 18px 0;line-height:1.6;">
        This email serves as an official status update regarding your Red Fiber Internet Service Application with PIGEM Combined Facilities Support Services.
      </p>

      <!-- Status Highlight Banner -->
      <div style="background:{badge_bg};border:1px solid {badge_border};border-radius:10px;padding:18px 20px;margin:20px 0;text-align:center;">
        <div style="font-size:11.5px;color:#667085;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">
          Reference No: {safe_ref}
        </div>
        <div style="font-size:22px;font-weight:900;color:{badge_color};margin:6px 0;letter-spacing:0.5px;">
          {safe_status}
        </div>
        <div style="font-size:12.5px;color:#475467;">
          Combined Facilities Support Services &bull; Dasmari\u00f1as City Processing Center
        </div>
      </div>

      {remarks_block}

      <!-- Next Steps & Guidance -->
      <div style="background:#ffffff;border:1px solid #eaecf0;border-radius:8px;padding:16px 18px;margin:20px 0;">
        <div style="font-size:13px;font-weight:700;color:#101828;margin-bottom:4px;">
          {guide_headline}
        </div>
        <div style="font-size:13px;color:#475467;line-height:1.6;">
          {guide_text}
        </div>
      </div>

      <div style="text-align:center;margin:26px 0;">
        <a href="{safe_portal}" style="display:inline-block;background:{BRAND_RED};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 26px;border-radius:6px;box-shadow:0 2px 4px rgba(200,16,46,0.2);">
          View Application in Customer Portal &rarr;
        </a>
      </div>

      <p style="font-size:13px;color:#667085;margin:24px 0 0 0;">
        Sincerely,<br>
        <b>Customer Provisioning &amp; Dispatch Desk</b><br>
        {COMPANY_NAME}
      </p>
    </div>
    """

    return _wrap_email_layout(
        subject=subject,
        preheader=preheader,
        content_html=content,
        accent_color=accent,
        badge_text="Status Update",
    )


# ==============================================================================
# 5. AGENT: Operational Notification (New Application Assigned / Resubmitted)
# ==============================================================================
def build_agent_alert_html(
    agent_name: str,
    event_type: str,
    ref_no: str,
    customer_name: str,
    plan_name: str,
    barangay: str,
    portal_link: str = DEFAULT_AGENT_URL,
    details: str = "",
) -> str:
    """
    Renders internal agent notification for assigned applications,
    customer correction resubmissions, and review milestones.
    """
    safe_agent = _escape(agent_name or "Agent")
    safe_event = _escape(event_type or "Application Alert")
    safe_ref = _escape(ref_no)
    safe_customer = _escape(customer_name)
    safe_plan = _escape(plan_name)
    safe_brgy = _escape(barangay)
    safe_details = _escape(details)
    subject = f"[PIGEM Agent Desk] {event_type} — Ref {ref_no}"
    preheader = f"Attention: {event_type} for application {ref_no} ({customer_name})."

    content = f"""
    <div>
      <div style="font-size:12px;font-weight:700;color:#175cd3;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
        Internal Operations Alert
      </div>
      <h1 style="font-size:20px;font-weight:800;color:{BRAND_DARK};margin:0 0 12px 0;">
        {safe_event}
      </h1>
      <p style="font-size:14px;color:#344054;margin:0 0 16px 0;">
        Hello <b>{safe_agent}</b>,
      </p>
      <p style="font-size:13.5px;color:#475467;margin:0 0 18px 0;line-height:1.6;">
        An application assigned to your queue requires action or review:
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #eaecf0;border-radius:8px;overflow:hidden;margin:18px 0;font-size:13px;">
        <tr>
          <td style="padding:10px 14px;color:#667085;background:#f9fafb;width:35%;font-weight:600;border-bottom:1px solid #eaecf0;">Reference No</td>
          <td style="padding:10px 14px;color:#101828;font-weight:700;border-bottom:1px solid #eaecf0;">{safe_ref}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#667085;background:#f9fafb;font-weight:600;border-bottom:1px solid #eaecf0;">Applicant Name</td>
          <td style="padding:10px 14px;color:#101828;border-bottom:1px solid #eaecf0;">{safe_customer}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#667085;background:#f9fafb;font-weight:600;border-bottom:1px solid #eaecf0;">Applied Plan</td>
          <td style="padding:10px 14px;color:#101828;border-bottom:1px solid #eaecf0;">{safe_plan}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#667085;background:#f9fafb;font-weight:600;">Barangay / Area</td>
          <td style="padding:10px 14px;color:#101828;">{safe_brgy}</td>
        </tr>
      </table>

      {"<div style='background:#f8f9fa;border-left:3px solid #175cd3;padding:10px 14px;margin:16px 0;font-size:12.5px;color:#344054;'><b>Note:</b> " + safe_details + "</div>" if safe_details else ""}

      <div style="text-align:center;margin:24px 0;">
        <a href="{_escape(portal_link)}" style="display:inline-block;background:#175cd3;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:10px 24px;border-radius:6px;">
          Open Agent Portal &rarr;
        </a>
      </div>
    </div>
    """

    return _wrap_email_layout(
        subject=subject,
        preheader=preheader,
        content_html=content,
        accent_color="#175cd3",
        badge_text="Agent Operational Notice",
    )


# ==============================================================================
# 6. MANAGER: Operations & Governance Summary Alert
# ==============================================================================
def build_manager_alert_html(
    manager_name: str,
    alert_title: str,
    summary_text: str,
    metrics: Optional[Dict[str, Any]] = None,
    portal_link: str = DEFAULT_MANAGER_URL,
) -> str:
    """
    Renders high-level management operational digest / escalation alert.
    """
    safe_manager = _escape(manager_name or "Operations Manager")
    safe_title = _escape(alert_title)
    safe_summary = _escape(summary_text)
    subject = f"[PIGEM Executive Management] {alert_title}"
    preheader = f"Management Briefing: {alert_title}."

    metrics_rows = ""
    if metrics:
        metrics_rows = '<div style="display:flex;flex-wrap:wrap;gap:12px;margin:18px 0;">'
        for k, v in metrics.items():
            metrics_rows += f"""
            <div style="background:#f8f9fa;border:1px solid #eaecf0;border-radius:8px;padding:12px 16px;min-width:120px;flex:1;">
              <div style="font-size:11px;color:#667085;text-transform:uppercase;font-weight:700;">{_escape(k)}</div>
              <div style="font-size:20px;font-weight:800;color:#101828;margin-top:2px;">{_escape(v)}</div>
            </div>
            """
        metrics_rows += "</div>"

    content = f"""
    <div>
      <div style="font-size:12px;font-weight:700;color:#344054;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
        Operations &amp; Governance Digest
      </div>
      <h1 style="font-size:21px;font-weight:800;color:{BRAND_DARK};margin:0 0 12px 0;">
        {safe_title}
      </h1>
      <p style="font-size:14px;color:#344054;margin:0 0 14px 0;">
        Dear <b>{safe_manager}</b>,
      </p>
      <div style="font-size:13.5px;color:#475467;line-height:1.6;margin-bottom:18px;">
        {safe_summary}
      </div>

      {metrics_rows}

      <div style="text-align:center;margin:24px 0;">
        <a href="{_escape(portal_link)}" style="display:inline-block;background:{BRAND_DARK};color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;padding:10px 24px;border-radius:6px;">
          Launch Management Dashboard &rarr;
        </a>
      </div>
    </div>
    """

    return _wrap_email_layout(
        subject=subject,
        preheader=preheader,
        content_html=content,
        accent_color=BRAND_DARK,
        badge_text="Executive Operations",
    )


# ==============================================================================
# 7. MARKETING: Promotional & Announcement Campaign (Authorized / Opted-In)
# ==============================================================================
def build_promotional_html(
    customer_name: str,
    headline: str,
    body_text: str,
    promo_plans: Optional[List[Dict[str, str]]] = None,
    cta_text: str = "Explore Fiber Plans",
    cta_url: str = "https://pigem-system-web.vercel.app/plans.html",
    unsubscribe_url: str = "https://pigem-system-web.vercel.app/customer.html?tab=settings",
) -> str:
    """
    Renders authorized promotional announcements, plan speed boosts,
    and Cavite community discount campaigns with CAN-SPAM compliant unsubscribe footer.
    """
    safe_name = _escape(customer_name or "Valued Subscriber")
    safe_headline = _escape(headline)
    safe_body = _escape(body_text).replace("\n", "<br>")
    subject = f"Special Announcement: {headline} &bull; PIGEM Red Fiber"
    preheader = f"Exciting new offers and fiber updates for Dasmariñas subscribers."

    plans_html = ""
    if promo_plans:
        plans_html = '<div style="margin:22px 0;">'
        for p in promo_plans:
            plans_html += f"""
            <div style="background:#ffffff;border:1px solid #eaecf0;border-left:4px solid {BRAND_RED};border-radius:6px;padding:12px 16px;margin-bottom:10px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:14px;font-weight:700;color:#101828;">{_escape(p.get('name'))}</div>
                    <div style="font-size:12px;color:#667085;">{_escape(p.get('speed'))} &bull; Unlimited Fiber</div>
                  </td>
                  <td align="right">
                    <div style="font-size:16px;font-weight:800;color:{BRAND_RED};">{_escape(p.get('price'))}</div>
                    <div style="font-size:11px;color:#98a2b3;">/ month</div>
                  </td>
                </tr>
              </table>
            </div>
            """
        plans_html += "</div>"

    content = f"""
    <div>
      <div style="font-size:12px;font-weight:700;color:{BRAND_RED};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
        Exclusive Subscriber Announcement
      </div>
      <h1 style="font-size:22px;font-weight:800;color:{BRAND_DARK};margin:0 0 12px 0;line-height:1.25;">
        {safe_headline}
      </h1>
      <p style="font-size:14px;color:#344054;margin:0 0 14px 0;">
        Dear <b>{safe_name}</b>,
      </p>
      <div style="font-size:13.5px;color:#475467;line-height:1.65;margin-bottom:18px;">
        {safe_body}
      </div>

      {plans_html}

      <div style="text-align:center;margin:28px 0;">
        <a href="{_escape(cta_url)}" style="display:inline-block;background:{BRAND_RED};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:6px;box-shadow:0 2px 4px rgba(200,16,46,0.2);">
          {_escape(cta_text)} &rarr;
        </a>
      </div>
    </div>
    """

    return _wrap_email_layout(
        subject=subject,
        preheader=preheader,
        content_html=content,
        accent_color=BRAND_RED,
        badge_text="Promotional Communication",
        unsubscribe_url=unsubscribe_url,
    )


# ==============================================================================
# Legacy / General Fallback Template
# ==============================================================================
def build_business_html(subject: str, message: str) -> str:
    """Backward-compatible general business notification."""
    safe_subject = _escape(subject or "Official Notification")
    safe_body = _escape(message or "").replace("\n", "<br>")

    content = f"""
    <div>
      <div style="font-size:16px;font-weight:700;color:{BRAND_DARK};margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #eaecf0;">
        {safe_subject}
      </div>
      <div style="font-size:14px;line-height:1.65;color:#344054;">
        {safe_body}
      </div>
    </div>
    """

    return _wrap_email_layout(
        subject=safe_subject,
        preheader=safe_subject,
        content_html=content,
        accent_color=BRAND_RED,
        badge_text="Business Notification",
    )


# ==============================================================================
# Dispatch Engine: Resend HTTP API Integration
# ==============================================================================
def send(
    to: str,
    subject: str,
    message: str = "",
    html_content: Optional[str] = None,
    template_type: str = "general",
    payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Core sender function.
    Dispatches via Resend API (https://api.resend.com/emails).
    Gracefully handles sandbox restrictions and returns rich metadata.
    """
    if not is_configured():
        print(f"[email skipped - no RESEND_API_KEY] to={to} subject={subject}")
        return {
            "sent": False,
            "offline": True,
            "reason": "RESEND_API_KEY is missing from environment.",
            "sandbox_restricted": False,
        }

    # Decide which HTML to send
    final_html = html_content
    payload = payload or {}

    if not final_html:
        # Detect template type if not explicitly set
        lowered_subj = (subject or "").lower()
        if template_type == "otp" or "otp" in lowered_subj or "verification code" in lowered_subj:
            code_match = re.search(r"\b(\d{6})\b", message) or re.search(r"\b(\d{6})\b", subject)
            extracted_code = payload.get("code") or (code_match.group(1) if code_match else "000000")
            final_html = build_otp_html(
                code=extracted_code,
                recipient_name=payload.get("customer_name") or payload.get("full_name") or "Valued Client",
                purpose=payload.get("purpose") or "Contact Verification",
            )
        elif template_type == "application_confirmation" or "application confirmation" in lowered_subj:
            final_html = build_application_confirmation_html(
                ref_no=payload.get("ref_no") or "PENDING",
                customer_name=payload.get("customer_name") or payload.get("full_name") or "",
                plan_name=payload.get("plan_name") or "Red Fiber",
                speed=payload.get("speed") or "Standard Speed",
                price=payload.get("price") or "₱1,299",
                address=payload.get("address") or "Dasmariñas City, Cavite",
                activation_link=payload.get("activation_link") or "",
                activation_code=payload.get("activation_code") or "",
                is_existing_account=payload.get("is_existing_account", False),
            )
        elif template_type == "correction_notice" or "correction" in lowered_subj or "update needed" in lowered_subj:
            final_html = build_correction_notice_html(
                ref_no=payload.get("ref_no") or "APPLICATION",
                customer_name=payload.get("customer_name") or payload.get("full_name") or "",
                portal_link=payload.get("portal_link") or DEFAULT_PORTAL_URL,
                target_summary=payload.get("target_summary") or "Document / Address Update",
            )
        elif template_type == "status_update" or "status update" in lowered_subj or "application update" in lowered_subj:
            final_html = build_status_update_html(
                ref_no=payload.get("ref_no") or "APPLICATION",
                customer_name=payload.get("customer_name") or payload.get("full_name") or "",
                new_status=payload.get("status") or "Updated",
                remarks=payload.get("remarks") or message,
                portal_link=payload.get("portal_link") or DEFAULT_PORTAL_URL,
            )
        elif template_type == "agent_alert":
            final_html = build_agent_alert_html(
                agent_name=payload.get("agent_name") or "Agent",
                event_type=payload.get("event_type") or "Application Notification",
                ref_no=payload.get("ref_no") or "APPLICATION",
                customer_name=payload.get("customer_name") or "",
                plan_name=payload.get("plan_name") or "",
                barangay=payload.get("barangay") or "",
                details=payload.get("details") or message,
            )
        elif template_type == "promotional":
            final_html = build_promotional_html(
                customer_name=payload.get("customer_name") or "Valued Client",
                headline=payload.get("headline") or subject,
                body_text=payload.get("body") or message,
                promo_plans=payload.get("promo_plans"),
            )
        else:
            final_html = build_business_html(subject, message)

    resend_from = os.getenv("RESEND_FROM", "PIGEM Support Services <onboarding@resend.dev>")
    api_key = os.getenv("RESEND_API_KEY", "")

    try:
        reply = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": resend_from,
                "to": [to],
                "subject": subject,
                "html": final_html,
            },
            timeout=15,
        )

        if reply.status_code < 300:
            res_data = reply.json()
            return {
                "sent": True,
                "id": res_data.get("id"),
                "reason": "",
                "sandbox_restricted": False,
            }

        # Check if error is Resend sandbox restriction (e.g. 403 trying to send to non-owner email on onboarding@resend.dev)
        res_data = reply.json() if "application/json" in reply.headers.get("Content-Type", "") else {}
        err_msg = res_data.get("message") or reply.text
        is_sandbox = reply.status_code == 403 and "own email address" in err_msg.lower()

        return {
            "sent": False,
            "status_code": reply.status_code,
            "reason": err_msg,
            "sandbox_restricted": is_sandbox,
        }

    except Exception as error:
        return {
            "sent": False,
            "reason": str(error),
            "sandbox_restricted": False,
        }
