// ============================================================================
// FILE: web/js/api.js
// PURPOSE: Cloud Backend Service Client for PIGEM System
// ----------------------------------------------------------------------------
// SHARED SCRIPT IMPORTS (Loaded before this file via HTML <script> tags):
//   1. web/js/config.js -> Provides global `CONFIG.PUBLIC_URL` and `CONFIG.API_URL`
//   2. web/js/db.js     -> Provides `dbGetToken()` to attach Supabase Auth Bearer JWTs
//   3. Browser Web APIs -> Uses built-in `fetch`, `FormData`, and `AbortController`
//
// CLOUD ARCHITECTURE NOTE:
//   All functions in this module communicate over HTTPS with the Vercel
//   Serverless Python FastAPI backend (`/api/*`) hosted in the same cloud
//   deployment. No local background daemon or third-party server is required.
// ============================================================================

// Resolves the live public portal base URL (e.g., https://pigem-system-web.vercel.app)
// so email links (activation links and Customer Account links) always point to the cloud site.
function _getPortalBaseUrl() {
  // Prefer the active browser window origin when running over HTTP/HTTPS
  if (typeof window !== "undefined" && window.location && window.location.origin && window.location.origin.indexOf("http") === 0) {
    return window.location.origin;
  }
  // Fallback to the configured cloud production URL defined in web/js/config.js
  return (typeof CONFIG !== "undefined" && CONFIG.PUBLIC_URL) ? CONFIG.PUBLIC_URL : "https://pigem-system-web.vercel.app";
}

// Builds a normalized serverless API URL path (e.g., "/api/verify-captcha")
// while stripping any trailing slash from CONFIG.API_URL.
function _apiEndpoint(path) {
  var base = (typeof CONFIG !== "undefined" && CONFIG.API_URL) ? CONFIG.API_URL : "/api";
  return base.replace(/\/$/, "") + path;
}

// ============================================================================
// 1. GOOGLE RECAPTCHA V2 VERIFICATION (`/api/verify-captcha`)
// ============================================================================
// Sends the single-use browser reCAPTCHA token to the Vercel Python API,
// which verifies it server-side with Google using `RECAPTCHA_SECRET_KEY`.
async function apiVerifyCaptcha(token) {
  var clean = String(token || "").trim();
  // Reject immediately if the user has not ticked the "I'm not a robot" box
  if (!clean) return { verified: false };

  try {
    var res = await fetch(_apiEndpoint("/verify-captcha"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: clean })
    });
    if (!res.ok) return { verified: false };
    var data = await res.json();
    return { verified: data.verified === true };
  } catch (err) {
    // Graceful network fallback so temporary ISP hiccups do not lock out applicants
    return { verified: true, fallback: true };
  }
}

// ============================================================================
// 2. ASYNCHRONOUS CLOUD REQUIREMENTS SCREENING (`/api/screen-async`)
// ============================================================================
// Triggers background OpenCV + Google Gemini Vision screening in Vercel Cloud
// right after the applicant's ID photos and application row are saved in Supabase.
// Uses `keepalive: true` so the customer gets their Reference Number immediately
// without waiting for image enhancement and OCR to finish.
function apiStartBackgroundScreening(applicationId) {
  if (!applicationId) return Promise.resolve({ queued: false });

  return (async function () {
    // Set a 55-second safety timeout matching Vercel serverless execution limits
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 55000) : null;
    try {
      var headers = { "Content-Type": "application/json" };
      // Attach Supabase Auth JWT if an authenticated session is active
      if (typeof dbGetToken === "function") {
        var token = await dbGetToken();
        if (token) headers["Authorization"] = "Bearer " + token;
      }
      var fetchOpts = {
        method: "POST",
        headers: headers,
        keepalive: true,
        body: JSON.stringify({ application_id: String(applicationId) })
      };
      if (controller) fetchOpts.signal = controller.signal;

      var res = await fetch(_apiEndpoint("/screen-async"), fetchOpts);
      if (timer) clearTimeout(timer);
      if (!res.ok) return { queued: false, offline: true };
      return await res.json();
    } catch (err) {
      // If cloud screening is temporarily unreachable, manual Agent review remains active
      if (timer) clearTimeout(timer);
      return { queued: false, offline: true };
    }
  })();
}

// ============================================================================
// 3. DIRECT SYNCHRONOUS SCREENING HELPER (`/api/screen`)
// ============================================================================
// Uploads Front (and optional Back) ID files plus structured applicant fields
// (`first_name`, `middle_name`, `last_name`, `birth_date`, `id_type`, `id_number`)
// directly to `/api/screen` and maps exact field comparison statuses.
async function apiRunScreening(idFrontFile, customerDetails, idBackFile) {
  // Default manual-review fallback object returned if the endpoint is unreachable
  var offlineResult = {
    preliminary: true,
    status: "offline",
    overall_status: "Manual Review",
    blur_score: "N/A",
    name_match: false,
    birth_date_match: false,
    id_number_match: false,
    issues: ["Automated screening service is currently unavailable. Manual verification is active."]
  };

  if (!idFrontFile) return offlineResult;

  try {
    var details = customerDetails || {};
    var formData = new FormData();

    // Attach Front ID image and optional Back ID image (from parameter or details object)
    formData.append("id_front", idFrontFile);
    var backBlob = idBackFile || details.id_back || null;
    if (backBlob) {
      formData.append("id_back", backBlob);
    }

    // Attach both combined and split name parts + ID metadata for high-accuracy matching
    formData.append("full_name", details.full_name || "");
    formData.append("first_name", details.first_name || "");
    formData.append("middle_name", details.middle_name || "");
    formData.append("last_name", details.last_name || "");
    formData.append("birth_date", details.birth_date || "");
    formData.append("id_type", details.id_type || "");
    formData.append("id_number", details.id_number || "");

    // Attach Supabase JWT Bearer token when available
    var headers = {};
    if (typeof dbGetToken === "function") {
      var token = await dbGetToken();
      if (token) headers["Authorization"] = "Bearer " + token;
    }

    var response = await fetch(_apiEndpoint("/screen"), {
      method: "POST",
      headers: headers,
      body: formData
    });

    if (!response.ok) return offlineResult;
    var data = await response.json();
    var q = data.quality || {};
    var notes = data.ai || {};
    var comps = Array.isArray(data.comparisons) ? data.comparisons : [];

    // Inspect deterministic Python FieldComparisonEngine results per field
    var nameComp = comps.find(function (c) { return c.key === "full_name"; });
    var dobComp = comps.find(function (c) { return c.key === "birth_date"; });
    var idComp = comps.find(function (c) { return c.key === "id_number"; });

    data.name_match = Boolean(nameComp && nameComp.status === "match");
    data.birth_date_match = Boolean(dobComp && dobComp.status === "match");
    data.id_number_match = Boolean(idComp && idComp.status === "match");

    // Flag "Needs Review" whenever OpenCV detects image issues or any field fails to match
    var hasQualityIssue = Boolean(q.issues && q.issues.length > 0);
    var hasFieldGap = comps.length > 0 && !(data.name_match && data.birth_date_match && data.id_number_match);
    data.overall_status = (hasQualityIssue || hasFieldGap) ? "Needs Review" : "Verified";
    data.blur_score = q.blur_score || "OK";
    data.issues = (notes.findings && notes.findings.length) ? notes.findings : (q.issues || []);
    return data;
  } catch (error) {
    return offlineResult;
  }
}

// ============================================================================
// 4. CORPORATE GMAIL SMTP DISPATCHER (`/api/notify`)
// ============================================================================
// Sends branded HTML emails through the Vercel Python `_mailer.py` service
// using `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD`.
async function apiSendEmail(toEmail, subjectText, messageText, options) {
  options = options || {};
  // Support shorthand string argument as `template_type`
  if (typeof options === "string") {
    options = { template_type: options };
  }
  var templateType = options.template_type || "general";
  var payload = options.payload || null;
  var htmlContent = options.html_content || null;

  try {
    var headers = { "Content-Type": "application/json" };
    if (typeof dbGetToken === "function") {
      var token = await dbGetToken();
      if (token) headers["Authorization"] = "Bearer " + token;
    }

    var res = await fetch(_apiEndpoint("/notify"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        to: toEmail,
        subject: subjectText,
        message: messageText || "",
        template_type: templateType,
        payload: payload,
        html_content: htmlContent
      })
    });

    if (res.ok) {
      var data = await res.json();
      return {
        sent: data.sent === true,
        id: data.id,
        unconfigured: Boolean(data.unconfigured),
        sandbox_restricted: Boolean(data.sandbox_restricted),
        reason: data.reason || ""
      };
    }

    // Parse structured error details if the SMTP relay returned an HTTP error
    var errData = {};
    try { errData = await res.json(); } catch (e) {}
    return {
      sent: false,
      status: res.status,
      reason: errData.reason || errData.detail || "Server error",
      unconfigured: Boolean(errData.unconfigured),
      sandbox_restricted: Boolean(errData.sandbox_restricted)
    };
  } catch (error) {
    return { sent: false, offline: true, reason: error.message };
  }
}

// Sends a 6-digit One-Time Password (OTP) email for Gmail verification,
// Customer Account activation, or password reset (`template_type: "otp"`).
async function apiSendOtpEmail(toEmail, code, purpose, recipientName) {
  var pName = recipientName || "Valued Applicant";
  var subj = "PIGEM Account Security - Your " + (purpose || "Verification") + " Code is " + code;
  var msg = "Your 6-Digit Verification Code is: " + code;
  return await apiSendEmail(toEmail, subj, msg, {
    template_type: "otp",
    payload: {
      code: String(code),
      purpose: purpose || "Contact Verification",
      customer_name: pName
    }
  });
}

// Sends an Application Confirmation email containing the applicant's Reference Number,
// selected fiber plan details, installation address, and one-click Account Activation link.
async function apiSendApplicationConfirmationEmail(toEmail, customerName, refNo, planObj, addressStr, accountInfo) {
  var p = planObj || {};
  var subj = "PIGEM Application Confirmation - Reference No. " + refNo;
  var msg = "Thank you for applying. Reference No: " + refNo;
  var isExisting = accountInfo && accountInfo.status === "active";
  var actCode = accountInfo && accountInfo.code ? accountInfo.code : "";
  var baseUrl = _getPortalBaseUrl();
  var actLink = baseUrl + "/activate.html?email=" + encodeURIComponent(toEmail) + "&code=" + encodeURIComponent(actCode);

  return await apiSendEmail(toEmail, subj, msg, {
    template_type: "application_confirmation",
    payload: {
      ref_no: refNo,
      customer_name: customerName || "Applicant",
      plan_name: p.name ? ("Red Fiber " + p.name) : "Red Fiber Plan",
      speed: p.speed ? (p.speed + " Mbps") : "Standard Speed",
      price: p.price ? ("₱" + Number(p.price).toLocaleString("en-PH")) : "₱1,400",
      address: addressStr || "Dasmariñas City, Cavite",
      activation_link: actLink,
      activation_code: actCode,
      is_existing_account: isExisting
    }
  });
}

// Sends a Data-Privacy-Safe (RA 10173 compliant) Correction Notice email
// inviting the applicant to sign in to their Customer Account without exposing
// sensitive ID numbers or document photos inside email text.
async function apiSendCorrectionEmail(toEmail, customerName, refNo, remarks, targetSummary) {
  var subj = "PIGEM Action Required - Update Needed for Reference No. " + refNo;
  var msg = remarks || ("Action required on your application " + refNo + ". Please sign in to your Customer Account to submit the requested update.");
  return await apiSendEmail(toEmail, subj, msg, {
    template_type: "correction_notice",
    payload: {
      ref_no: refNo,
      customer_name: customerName,
      remarks: remarks || "",
      portal_link: _getPortalBaseUrl() + "/customer.html",
      target_summary: targetSummary || "Information / Document Clarification Required"
    }
  });
}

// Sends a Customer Application Status Update email.
// Enforces PIGEM's simplified 3-stage customer visibility rule:
// Customers only see "Processing", "Approved", or "Rejected" (plus correction notices).
async function apiSendStatusEmail(toEmail, customerName, refNo, status, remarks, targetSummary) {
  var st = (status || "").toLowerCase();
  // Route correction requests to the dedicated RA 10173 privacy-safe notice template
  if (st.indexOf("correction") !== -1 || st.indexOf("need") !== -1) {
    return await apiSendCorrectionEmail(toEmail, customerName, refNo, remarks, targetSummary);
  }
  var customerStatus = "Processing";
  if (st.indexOf("approv") !== -1) customerStatus = "Approved";
  else if (st.indexOf("reject") !== -1) customerStatus = "Rejected";

  var subj = "PIGEM Application Update - Reference No. " + refNo + " [" + customerStatus + "]";
  var msg = "Application " + refNo + " status: " + customerStatus + (remarks ? ("\n\nRemarks: " + remarks) : "");
  return await apiSendEmail(toEmail, subj, msg, {
    template_type: "status_update",
    payload: {
      ref_no: refNo,
      customer_name: customerName,
      status: customerStatus,
      remarks: remarks || "",
      portal_link: _getPortalBaseUrl() + "/customer.html"
    }
  });
}

// Sends a Promotional / Service Announcement email exclusively to opted-in
// customers (`marketing_opt_in = true`) with verified `@gmail.com` addresses.
async function apiSendPromotionalEmail(toEmail, customerName, headline, bodyText, promoPlans) {
  var subj = headline + " - PIGEM Red Fiber";
  return await apiSendEmail(toEmail, subj, bodyText, {
    template_type: "promotional",
    payload: {
      customer_name: customerName,
      headline: headline,
      body: bodyText,
      promo_plans: promoPlans || []
    }
  });
}

// ============================================================================
// 5. CLOUD HEALTH & POLITE REMARK DRAFTING HELPERS
// ============================================================================
// Checks `/api/health` on the Vercel Python service (used by Admin Diagnostics
// to display whether OpenCV, Gemini Vision, Gmail SMTP, and reCAPTCHA are active).
async function apiCheckHealth() {
  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
  try {
    var opts = controller ? { signal: controller.signal } : {};
    var response = await fetch(_apiEndpoint("/health"), opts);
    if (timer) clearTimeout(timer);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    if (timer) clearTimeout(timer);
    return null;
  }
}

// Calls `/api/polite-remark` so an Agent's brief note (e.g., "blurry id") is
// rewritten into a warm, respectful 2-sentence plain-English message for the Customer.
async function apiGeneratePoliteRemark(rawRemark, chosenField) {
  var text = String(rawRemark || "").trim();
  var field = chosenField || "auto";

  var headers = { "Content-Type": "application/json" };
  try {
    if (typeof dbGetToken === "function") {
      var token = await dbGetToken();
      if (token) headers["Authorization"] = "Bearer " + token;
    }
  } catch (e) {}

  var res = await fetch(_apiEndpoint("/polite-remark"), {
    method: "POST",
    headers: headers,
    body: JSON.stringify({ raw_remark: text, chosen_field: field })
  });

  if (!res.ok) {
    throw new Error("Message helper service is currently unavailable. Please select a preset or type the customer message manually.");
  }

  var data = await res.json();
  return {
    polite_message: data.polite_message || data.message || "",
    target_fields: data.target_fields || data.fields || [],
    available: data.available !== false
  };
}
