function _getPortalBaseUrl() {
  if (typeof window !== "undefined" && window.location && window.location.origin && window.location.origin.indexOf("http") === 0) {
    return window.location.origin;
  }
  return (typeof CONFIG !== "undefined" && CONFIG.PUBLIC_URL) ? CONFIG.PUBLIC_URL : "https://pigem-system-web.vercel.app";
}

function _apiEndpoint(path) {
  var base = (typeof CONFIG !== "undefined" && CONFIG.API_URL) ? CONFIG.API_URL : "/api";
  return base.replace(/\/$/, "") + path;
}

async function apiVerifyCaptcha(token) {
  var clean = String(token || "").trim();
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
    return { verified: true, fallback: true };
  }
}

function apiStartBackgroundScreening(applicationId) {
  if (!applicationId) return Promise.resolve({ queued: false });

  return (async function () {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 55000) : null;
    try {
      var headers = { "Content-Type": "application/json" };
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
      if (timer) clearTimeout(timer);
      return { queued: false, offline: true };
    }
  })();
}

async function apiRunScreening(idFrontFile, customerDetails) {
  var offlineResult = {
    preliminary: true,
    status: "offline",
    overall_status: "Manual Review",
    blur_score: "N/A",
    name_match: false,
    id_number_match: false,
    issues: ["Automated screening service is currently unavailable. Manual verification is active."]
  };

  if (!idFrontFile) return offlineResult;

  try {
    var formData = new FormData();
    formData.append("id_front", idFrontFile);
    formData.append("full_name", (customerDetails && customerDetails.full_name) || "");
    formData.append("birth_date", (customerDetails && customerDetails.birth_date) || "");
    formData.append("id_number", (customerDetails && customerDetails.id_number) || "");

    var headers = {};
    var token = await dbGetToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
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
    data.overall_status = (q.issues && q.issues.length > 0) ? "Needs Review" : "Verified";
    data.blur_score = q.blur_score || "OK";
    data.name_match = true;
    data.id_number_match = true;
    data.issues = (notes.findings && notes.findings.length) ? notes.findings : (q.issues || []);
    return data;
  } catch (error) {
    return offlineResult;
  }
}

async function apiSendEmail(toEmail, subjectText, messageText, options) {
  options = options || {};
  if (typeof options === "string") {
    options = { template_type: options };
  }
  var templateType = options.template_type || "general";
  var payload = options.payload || null;
  var htmlContent = options.html_content || null;

  try {
    var headers = { "Content-Type": "application/json" };
    var token = await dbGetToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
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

async function apiSendStatusEmail(toEmail, customerName, refNo, status, remarks, targetSummary) {
  var st = (status || "").toLowerCase();
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

async function apiGeneratePoliteRemark(rawRemark, chosenField) {
  var text = String(rawRemark || "").trim();
  var field = chosenField || "auto";

  var headers = { "Content-Type": "application/json" };
  try {
    var token = await dbGetToken();
    if (token) headers["Authorization"] = "Bearer " + token;
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
