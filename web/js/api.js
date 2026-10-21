// ============================================================
// PYTHON FASTAPI CLIENT (Local AI Document Screening & Resend Emails)
// Runs strictly against the local Python server (http://127.0.0.1:8001)
// powered by OpenCV, PaddleOCR, Ollama (qwen2.5:1.5b), and Resend.
// If the local Python / Ollama server is not running, the system clearly
// reports that AI is offline and falls back to manual agent verification.
// ============================================================

// MAJOR: Send the uploaded ID image and typed fields to the local Python FastAPI service (/screen)
async function apiRunScreening(idFrontFile, customerDetails) {
  var offlineResult = {
    preliminary: true,
    status: "offline",
    overall_status: "AI Offline (Manual Review)",
    blur_score: "Offline",
    name_match: false,
    id_number_match: false,
    issues: ["Local AI Screening Server (OpenCV / PaddleOCR / Ollama) is offline. Manual agent verification is active."]
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

    var response = await fetch(CONFIG.API_URL + "/screen", {
      method: "POST",
      headers: headers,
      body: formData
    });

    if (!response.ok) return offlineResult;
    var data = await response.json();
    var q = data.quality || {};
    var ai = data.ai || {};
    data.overall_status = (q.issues && q.issues.length > 0) ? "Needs Review" : "Verified";
    data.blur_score = q.blur_score || q.sharpness || "OK";
    data.name_match = data.comparison ? Boolean(data.comparison.name_matched) : true;
    data.id_number_match = data.comparison ? Boolean(data.comparison.id_number_matched) : true;
    data.issues = (ai.findings && ai.findings.length) ? ai.findings : (q.issues || []);
    return data;
  } catch (error) {
    return offlineResult;
  }
}

// MAJOR: Send corporate email notification via Python FastAPI (/notify) & Resend
// Supports rich typed templates: 'otp' | 'application_confirmation' | 'correction_notice' | 'status_update' | 'agent_alert' | 'manager_alert' | 'promotional'
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

    var res = await fetch(CONFIG.API_URL + "/notify", {
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
        sent: data.sent !== false,
        id: data.id,
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
      sandbox_restricted: Boolean(errData.sandbox_restricted)
    };
  } catch (error) {
    // Local Python server is offline; in-app Supabase notifications continue seamlessly
    return { sent: false, offline: true, reason: error.message };
  }
}

// MAJOR: Send 6-Digit Security OTP Email (Contact, Registration, Password Reset)
async function apiSendOtpEmail(toEmail, code, purpose, recipientName) {
  var pName = recipientName || "Valued Applicant";
  var subj = "PIGEM Account Security — Your " + (purpose || "Verification") + " Code is " + code;
  var msg = "Your 6-Digit OTP Verification Code is: " + code;
  return await apiSendEmail(toEmail, subj, msg, {
    template_type: "otp",
    payload: {
      code: String(code),
      purpose: purpose || "Contact Verification",
      customer_name: pName
    }
  });
}

// MAJOR: Send Application Confirmation Email with Reference Number, Plan Specs, and Activation
async function apiSendApplicationConfirmationEmail(toEmail, customerName, refNo, planObj, addressStr, accountInfo) {
  var p = planObj || {};
  var subj = "PIGEM Application Confirmation — Reference No. " + refNo;
  var msg = "Thank you for applying. Reference No: " + refNo;
  var isExisting = accountInfo && accountInfo.status === "active";
  var actCode = accountInfo && accountInfo.code ? accountInfo.code : "";
  var actLink = "https://pigem-system-web.vercel.app/activate.html?email=" + encodeURIComponent(toEmail) + "&code=" + encodeURIComponent(actCode);

  return await apiSendEmail(toEmail, subj, msg, {
    template_type: "application_confirmation",
    payload: {
      ref_no: refNo,
      customer_name: customerName || "Applicant",
      plan_name: p.name ? ("Red Fiber " + p.name) : "Red Fiber Plan",
      speed: p.speed ? (p.speed + " Mbps") : "Standard Speed",
      price: p.price ? ("₱" + Number(p.price).toLocaleString("en-PH")) : "₱1,299",
      address: addressStr || "Dasmariñas City, Cavite",
      activation_link: actLink,
      activation_code: actCode,
      is_existing_account: isExisting
    }
  });
}

// MAJOR: Send Privacy-Safe Correction Email (RA 10173 Compliant - Directs to Authenticated Portal)
async function apiSendCorrectionEmail(toEmail, customerName, refNo, remarks) {
  var subj = "PIGEM Action Required — Update Needed for Reference No. " + refNo;
  var msg = "Action required on your application " + refNo + ". Please sign in to the Customer Portal to update your application.";
  return await apiSendEmail(toEmail, subj, msg, {
    template_type: "correction_notice",
    payload: {
      ref_no: refNo,
      customer_name: customerName,
      portal_link: "https://pigem-system-web.vercel.app/customer.html",
      target_summary: "Information / Document Clarification Required"
    }
  });
}

// MAJOR: Send Status Update Email (Approved, Encoded to Provider, Rejected, Processing)
async function apiSendStatusEmail(toEmail, customerName, refNo, status, remarks) {
  var st = (status || "").toLowerCase();
  if (st.indexOf("correction") !== -1 || st.indexOf("need") !== -1) {
    return await apiSendCorrectionEmail(toEmail, customerName, refNo, remarks);
  }
  var subj = "PIGEM Application Update — Reference No. " + refNo + " [" + status + "]";
  var msg = "Application " + refNo + " status: " + status + (remarks ? ("\n\nRemarks: " + remarks) : "");
  return await apiSendEmail(toEmail, subj, msg, {
    template_type: "status_update",
    payload: {
      ref_no: refNo,
      customer_name: customerName,
      status: status,
      remarks: remarks || "",
      portal_link: "https://pigem-system-web.vercel.app/customer.html"
    }
  });
}

// MAJOR: Send Internal Agent Alert Email
async function apiSendAgentAlertEmail(agentEmail, eventType, refNo, customerName, planName, barangay, details) {
  var subj = "[PIGEM Agent Desk] " + (eventType || "Application Alert") + " — Ref " + refNo;
  return await apiSendEmail(agentEmail, subj, details || "", {
    template_type: "agent_alert",
    payload: {
      agent_name: "Agent",
      event_type: eventType,
      ref_no: refNo,
      customer_name: customerName,
      plan_name: planName,
      barangay: barangay,
      details: details,
      portal_link: "https://pigem-system-web.vercel.app/agent.html"
    }
  });
}

// MAJOR: Send Management Operations Alert Email
async function apiSendManagerAlertEmail(managerEmail, title, summary, metrics) {
  var subj = "[PIGEM Executive Management] " + title;
  return await apiSendEmail(managerEmail, subj, summary || "", {
    template_type: "manager_alert",
    payload: {
      manager_name: "Operations Manager",
      alert_title: title,
      summary_text: summary,
      metrics: metrics || null,
      portal_link: "https://pigem-system-web.vercel.app/manager.html"
    }
  });
}

// MAJOR: Send Promotional Campaign Email to opted-in subscribers
async function apiSendPromotionalEmail(toEmail, customerName, headline, bodyText, promoPlans) {
  var subj = "Special Announcement: " + headline + " • PIGEM Red Fiber";
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

// MAJOR: Check which local Python services (FastAPI, OpenCV, PaddleOCR, Ollama, Resend) are active
async function apiCheckHealth() {
  try {
    var response = await fetch(CONFIG.API_URL + "/health");
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

// MAJOR: Ask local Python/Ollama (/polite-remark) to convert a raw RADIUS/Validator remark
// into a polite customer message + detect the exact field(s) to fix.
// If the local Python/Ollama service is offline, returns offline: true so the UI tells the Agent AI is offline.
async function apiGeneratePoliteRemark(rawRemark, chosenField) {
  var text = String(rawRemark || "").trim();
  var field = chosenField || "auto";

  var headers = { "Content-Type": "application/json" };
  try {
    var token = await dbGetToken();
    if (token) headers["Authorization"] = "Bearer " + token;
  } catch (e) {}

  var res = await fetch(CONFIG.API_URL + "/polite-remark", {
    method: "POST",
    headers: headers,
    body: JSON.stringify({ raw_remark: text, chosen_field: field })
  });

  if (!res.ok) {
    throw new Error("Local AI Service (Ollama) is offline. Please start START-AI.bat or type the customer instruction manually.");
  }

  var data = await res.json();
  return {
    polite_message: data.polite_message || data.message || "",
    target_fields: data.target_fields || data.fields || [],
    ai_available: data.ai_available !== false
  };
}
