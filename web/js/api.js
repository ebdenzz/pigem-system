// ============================================================
// PYTHON FASTAPI CLIENT (AI Document Screening & Resend Emails)
// ============================================================

// MAJOR: Send the uploaded ID image and typed fields to the Python FastAPI service (/screen)
// Python runs: OpenCV quality check -> PaddleOCR text extraction -> Comparison -> Ollama AI guidance
async function apiRunScreening(idFrontFile, customerDetails) {
  var fallbackResult = {
    preliminary: true,
    status: "not_available",
    notice: "Python screening service is not running. Please review the ID document manually."
  };

  if (!idFrontFile) return fallbackResult;

  try {
    var formData = new FormData();
    formData.append("id_front", idFrontFile);
    formData.append("full_name", customerDetails.full_name || "");
    formData.append("birth_date", customerDetails.birth_date || "");
    formData.append("id_number", customerDetails.id_number || "");

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

    if (!response.ok) return fallbackResult;
    return await response.json();
  } catch (error) {
    return fallbackResult;
  }
}

// MAJOR: Ask the Python FastAPI service (/notify) to send an email via Resend
async function apiSendEmail(toEmail, subjectText, messageText) {
  try {
    var headers = { "Content-Type": "application/json" };
    var token = await dbGetToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    await fetch(CONFIG.API_URL + "/notify", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        to: toEmail,
        subject: subjectText,
        message: messageText
      })
    });
  } catch (error) {
    // Email is optional during local testing; do not block the application
  }
}

// MAJOR: Check which Python services (FastAPI, OpenCV, PaddleOCR, Ollama, Resend) are active
async function apiCheckHealth() {
  try {
    var response = await fetch(CONFIG.API_URL + "/health");
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}


// MAJOR: Ask Python/Ollama (/polite-remark) to convert a raw RADIUS/Validator remark
// into a polite customer message + detect the exact field(s) to fix (e.g. email vs phone)
async function apiGeneratePoliteRemark(rawRemark, chosenField) {
  var text = String(rawRemark || "").trim();
  var field = chosenField || "auto";

  // Local fallback if Python server is unreachable
  var localFields = [];
  if (field && field !== "auto") {
    localFields = [field];
  } else {
    var low = text.toLowerCase();
    if (low.indexOf("email") !== -1 || low.indexOf("gmail") !== -1) localFields.push("email");
    if (low.indexOf("phone") !== -1 || low.indexOf("mobile") !== -1 || low.indexOf("number already") !== -1) localFields.push("phone");
    if (low.indexOf("blur") !== -1 || low.indexOf("photo") !== -1 || low.indexOf("id") !== -1) localFields.push("id_photo");
    if (localFields.length === 0) localFields.push("general");
  }

  var fallbackMsg = "Hello! During verification, we noticed an issue (" + (text || "details need updating") + "). Please update the highlighted field in your portal so we can continue processing your application.";
  if (localFields.indexOf("email") !== -1 && localFields.indexOf("phone") === -1) {
    fallbackMsg = "Hello! During provider encoding, our system detected that your Email Address is already registered in the provider portal. Please provide a new, unused Email Address in your correction form so we can continue processing your application.";
  } else if (localFields.indexOf("phone") !== -1 && localFields.indexOf("email") === -1) {
    fallbackMsg = "Hello! During provider encoding, our system detected that your Mobile Number is already registered in the provider portal. Please provide a new, unused Mobile Number in your correction form so we can continue processing your application.";
  }

  try {
    var headers = { "Content-Type": "application/json" };
    var token = await dbGetToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    var res = await fetch(CONFIG.API_URL + "/polite-remark", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ raw_remark: text, chosen_field: field })
    });
    if (!res.ok) return { message: fallbackMsg, fields: localFields };
    return await res.json();
  } catch (e) {
    return { message: fallbackMsg, fields: localFields };
  }
}
