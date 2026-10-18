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

// MAJOR: Ask the local Python FastAPI service (/notify) to send an email via Resend
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
    // Local Python server is offline; in-app Supabase notifications still work
  }
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
    throw new Error("Local AI Service (Ollama) is offline. Please start START-SYSTEM.bat or type the customer instruction manually.");
  }

  var data = await res.json();
  return {
    polite_message: data.polite_message || data.message || "",
    target_fields: data.target_fields || data.fields || [],
    ai_available: data.ai_available !== false
  };
}
