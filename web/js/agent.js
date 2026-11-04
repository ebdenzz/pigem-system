var currentAgent = null;
var allApps = [];
var activeBranch = "overview";
var activeDetailAppId = null;
var activeCopyMode = "latest";
var activeIdImgMode = "cropped";
var pendingProofDataUrl = "";
var lastDetectedFields = null;
var isScreeningServiceOnline = true;

var FIELD_SUMMARY_LABELS = {
  auto: "Information / Document Clarification",
  name: "Applicant Name Update",
  birth_date: "Birth Date Confirmation",
  id_photo: "Clearer Valid ID Photo Upload",
  id_number: "Primary ID Number Verification",
  email: "Alternate Email Address",
  phone: "Alternate Mobile Number",
  email_or_phone: "Email & Mobile Number Update",
  address: "Complete Installation Address / Landmark"
};

async function checkAgentScreeningService() {
  var banner = document.getElementById("agent-screening-banner");
  if (!isAiEnabled()) {
    isScreeningServiceOnline = false;
    if (banner) banner.classList.remove("hidden");
    return false;
  }
  if (typeof apiCheckHealth === "function") {
    var health = await apiCheckHealth();
    if (!health || health.status !== "ok" || health.auto_screening_ready === false) {
      isScreeningServiceOnline = false;
      if (banner) banner.classList.remove("hidden");
      if (typeof dbNotifyScreeningUnavailable === "function") {
        await dbNotifyScreeningUnavailable("", "", "Auto-screening service is currently offline. Original uploaded ID copies remain available for manual review.");
      }
      return false;
    }
  }
  isScreeningServiceOnline = true;
  if (banner) banner.classList.add("hidden");
  return true;
}

var VALIDATOR_PRESETS = [
  { label: "-- Optional: Select a Preset Remark --", raw: "", field: "auto", msg: "" },
  { label: "[Common] Applicant Name Mismatch with ID", raw: "Applicant name entered does not match Valid ID", field: "name", msg: "The name entered on your application form does not match the name printed on your Valid ID. Please review and update your name." },
  { label: "[Common] Duplicate Email in Provider Portal", raw: "Duplicate email address in provider portal", field: "email", msg: "Your email address is already linked to an existing record with the provider. Please provide an alternate active email address." },
  { label: "[Common] Duplicate Mobile Number in Provider Portal", raw: "Mobile number already exists in provider system", field: "phone", msg: "The mobile number provided is already registered in the provider system. Please update your mobile number." },
  { label: "[Common] Both Email & Mobile Duplicate", raw: "Duplicate email and mobile number in subscriber database", field: "email_or_phone", msg: "Both your email and mobile number are already linked to an existing account. Please provide an alternate email and mobile number." },
  { label: "[Common] Blurry / Unreadable Valid ID", raw: "Uploaded valid ID photo is blurry or unreadable", field: "id_photo", msg: "Your uploaded Valid ID is blurry and could not be clearly read. Please upload a clearer photo of your Valid ID." },
  { label: "[Common] ID Lighting Glare / Flash", raw: "Lighting glare covering text on valid ID", field: "id_photo", msg: "There is lighting glare covering details on your ID. Please take a photo in a well-lit area without flash." },
  { label: "[Common] ID Edges / Corners Cut Off", raw: "Valid ID corners or borders are cut off", field: "id_photo", msg: "Some edges of your Valid ID are cut off. Please upload a photo showing all 4 corners of the ID." },
  { label: "[Common] Primary ID Number Mismatch", raw: "ID number entered does not match number printed on ID", field: "id_number", msg: "The ID number entered in the form does not match the number on your Valid ID. Please check and update your ID number." },
  { label: "[Rare] Address Incomplete / Missing Landmark", raw: "Installation address missing street detail or landmark", field: "address", msg: "Please add a clearer street detail or nearest landmark to help locate your installation address." },
  { label: "[Rare] Expired Valid ID", raw: "Submitted government ID has expired", field: "id_photo", msg: "The submitted ID appears to be expired. Please upload an unexpired Valid ID." }
];

function renderValidatorPresetOptions(filterText) {
  var term = String(filterText || "").toLowerCase().trim();
  var optionsHtml = "<option value=''>-- Select Optional Remark Preset --</option>";

  for (var i = 1; i < VALIDATOR_PRESETS.length; i++) {
    var p = VALIDATOR_PRESETS[i];
    if (term) {
      var combined = (p.label + " " + p.raw + " " + p.msg).toLowerCase();
      if (combined.indexOf(term) === -1) continue;
    }
    optionsHtml += "<option value='" + i + "'>" + escapeHtml(p.label) + "</option>";
  }
  return optionsHtml;
}

function filterValidatorPresets(term) {
  var sel = document.getElementById("det-preset-select");
  if (sel) sel.innerHTML = renderValidatorPresetOptions(term);
}

function onValidatorPresetChange(val) {
  var idx = parseInt(val, 10);
  if (isNaN(idx) || idx <= 0 || idx >= VALIDATOR_PRESETS.length) return;

  var p = VALIDATOR_PRESETS[idx];
  var rawEl = document.getElementById("det-validator-raw");
  var fieldEl = document.getElementById("det-correction-field");
  var corrMsgEl = document.getElementById("det-correction-message");

  if (rawEl) rawEl.value = p.raw;
  if (fieldEl) fieldEl.value = p.field;
  if (corrMsgEl) corrMsgEl.value = p.msg;
}

function isScreeningActiveOnApp(app) {
  var scr = (app && app.screening) || {};
  return scr.state === "queued" || scr.state === "layer1_running" || scr.state === "layer2_running";
}

function formatEtaLabel(seconds) {
  var sec = Number(seconds || 0);
  if (!sec || sec <= 0) return "";
  if (sec >= 60) {
    var mins = Math.ceil(sec / 60);
    return "~" + mins + (mins === 1 ? " min" : " mins") + " left";
  }
  return "~" + sec + "s left";
}

function cleanScreeningText(str) {
  return String(str || "")
    .replace(/\bAI Screening Engine\b/gi, "Application Screening")
    .replace(/\bAI Document Screening\b/gi, "Application Screening")
    .replace(/\bOpenCV\s*&\s*PaddleOCR\b/gi, "Document check")
    .replace(/\b(OpenCV|PaddleOCR|Ollama|Qwen\S*|AI)\b/gi, "Screening")
    .replace(/\bScreening\s+Screening\b/gi, "Screening");
}

window.addEventListener("DOMContentLoaded", async function () {
  currentAgent = await requireLogin(["agent", "manager", "admin"]);
  if (!currentAgent) return;

  document.getElementById("top-user-name").textContent = currentAgent.full_name;
  await checkAgentScreeningService();
  await refreshAgentData();
  initDashUI(currentAgent, allApps, openAppDetail);

  setTimeout(function () {
    if (typeof POPUP_GUIDE_MANAGER !== "undefined") {
      POPUP_GUIDE_MANAGER.autoShowForPortal("agent_workspace_guide");
    }
  }, 220);

  setInterval(function () {
    checkAgentScreeningService();
  }, 20000);

  setInterval(async function () {
    var anyRunning = false;
    for (var i = 0; i < allApps.length; i++) {
      if (isScreeningActiveOnApp(allApps[i])) {
        anyRunning = true;
        break;
      }
    }
    var activeTag = document.activeElement ? document.activeElement.tagName : "";
    var isTyping = (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT");

    if (anyRunning || !isTyping) {
      await refreshAgentData(true);
      var modal = document.getElementById("app-detail-modal");
      if (modal && !modal.classList.contains("hidden") && activeDetailAppId && !isTyping) {
        await renderDetailModalContent();
      }
    }
  }, 4500);
});

function isEncodedOrApproved(app) {
  var st = app.status || "";
  return st === "Encoding" || st === "Approved" || st === "Submitted to Provider" || Boolean(app.encoded);
}

async function refreshAgentData(silent) {
  allApps = await dbListAllApplications();
  updateDashSearchApps(allApps);

  var unclaimed = 0;
  var myClaimed = 0;
  var fix = 0;
  var encodedCount = 0;
  var planCounts = { "1000": 0, "1400": 0, "1900": 0 };

  for (var i = 0; i < allApps.length; i++) {
    var a = allApps[i];

    if (!a.assigned_agent && a.status === "Pending Review") unclaimed++;
    if (a.assigned_agent === currentAgent.email && (a.status === "Pending Review" || a.status === "Under Agent Review" || a.status === "Encoding")) myClaimed++;
    if (a.status === "Needs Correction") fix++;
    if (isEncodedOrApproved(a)) encodedCount++;

    var planStr = String(a.plan_name || "");
    if (planStr.indexOf("1000") !== -1) planCounts["1000"]++;
    else if (planStr.indexOf("1400") !== -1) planCounts["1400"]++;
    else if (planStr.indexOf("1900") !== -1) planCounts["1900"]++;
  }

  document.getElementById("cnt-queue").textContent = unclaimed;
  document.getElementById("cnt-claimed").textContent = myClaimed;
  document.getElementById("cnt-correction").textContent = fix;
  document.getElementById("cnt-encoded").textContent = encodedCount;

  document.getElementById("st-unclaimed").textContent = unclaimed;
  document.getElementById("st-myclaimed").textContent = myClaimed;
  document.getElementById("st-fix").textContent = fix;
  document.getElementById("st-encoded").textContent = encodedCount;

  if (!silent) {
    renderBars("chart-agent-bars", [
      { label: "Unclaimed", value: unclaimed, color: "#64748b" },
      { label: "My Active", value: myClaimed, color: "#2563eb" },
      { label: "Needs Fix", value: fix, color: "#d97706" },
      { label: "Encoding / Approved", value: encodedCount, color: "#15803d" }
    ]);
    renderColumns("chart-agent-cols", [
      { label: "Plan 1000", value: planCounts["1000"], color: "#c8102e" },
      { label: "Plan 1400", value: planCounts["1400"], color: "#0f172a" },
      { label: "Plan 1900", value: planCounts["1900"], color: "#2563eb" }
    ]);
    renderCalendar("agent-calendar", allApps);
    await renderAgentLinks();
  }

  renderAgentCards();
}

function showTab(branch) {
  activeBranch = branch;
  var navIds = ["overview", "queue", "claimed", "correction", "encoded", "links"];
  for (var i = 0; i < navIds.length; i++) {
    var btn = document.getElementById("nav-" + navIds[i]);
    if (btn) btn.classList.toggle("active", navIds[i] === branch);
  }

  document.getElementById("tab-overview").classList.toggle("hidden", branch !== "overview");
  document.getElementById("tab-links").classList.toggle("hidden", branch !== "links");

  var isAppBranch = (branch === "queue" || branch === "claimed" || branch === "correction" || branch === "encoded");
  document.getElementById("tab-apps").classList.toggle("hidden", !isAppBranch);

  if (isAppBranch) {
    var titles = {
      queue: ["Application Queue (Unclaimed)", "Customer applications incoming for screening and agent handling."],
      claimed: ["My Claimed Applications", "Manage your claimed applications: forward for Encoding and record the Validator's Approved / Rejected decision."],
      correction: ["Needs Correction", "Applications awaiting customer updates (requested automatically during screening or manually by an agent)."],
      encoded: ["Encoding & Approved Applications", "Applications forwarded to the Validator (Encoding) or Approved."]
    };
    document.getElementById("apps-heading").textContent = titles[branch][0];
    document.getElementById("apps-subtitle").textContent = titles[branch][1];
    renderAgentCards();
  }
}

function getScreeningCardBadge(app) {
  var scr = app.screening || {};
  var state = scr.state || "";
  if (!isAiEnabled() || !isScreeningServiceOnline || state === "unavailable" || state === "paused" || scr.fallback_original_only) {
    return '<span class="badge badge-gray">Original ID Copy (Manual Review)</span>';
  }
  var eta = formatEtaLabel(scr.eta_seconds);

  if (state === "queued" || state === "layer1_running") {
    return '<span class="badge badge-blue">Screening in Progress' + (eta ? " (" + escapeHtml(eta) + ")" : "") + '</span>';
  }
  if (state === "layer2_running") {
    if (scr.severity === "warning") {
      return '<span class="badge badge-yellow">Enhancing Document' + (eta ? " (" + escapeHtml(eta) + ")" : "") + ' - Hold Recommended</span>';
    }
    return '<span class="badge badge-blue">Cropping &amp; Verifying' + (eta ? " (" + escapeHtml(eta) + ")" : "") + '</span>';
  }
  if (scr.auto_correction_sent) {
    return '<span class="badge badge-yellow">Auto-Requested Customer Update</span>';
  }

  var res = app.ai_result || {};
  var st = res.overall_status || "Checked";
  if (st === "Verified") {
    return '<span class="badge badge-green">Screening Passed</span>';
  }
  if (st.indexOf("Needs") !== -1) {
    return '<span class="badge badge-yellow">Review Recommended</span>';
  }
  return '<span class="badge badge-gray">Screening Checked</span>';
}

function getScreeningQuickSummary(app) {
  var scr = app.screening || {};
  if (!isAiEnabled() || !isScreeningServiceOnline || scr.state === "unavailable" || scr.state === "paused" || scr.fallback_original_only) {
    return '<span class="muted">Auto-screening unavailable - customer\'s original uploaded ID photo is ready for manual review.</span>';
  }
  if (scr.state === "queued" || scr.state === "layer1_running" || scr.state === "layer2_running") {
    return '<span>' + escapeHtml(scr.advisory || "Screening in progress...") + '</span>';
  }
  if (scr.auto_correction_sent && scr.auto_correction_reason) {
    return '<span>Automatically requested update from customer: <b>' + escapeHtml(scr.auto_correction_reason) + '</b></span>';
  }
  var res = app.ai_result || {};
  var note = (res.issues && res.issues.length > 0) ? cleanScreeningText(res.issues.join("; ")) : "Document clear and details match.";
  return '<span class="muted">' + escapeHtml(note) + '</span>';
}

function renderAgentCards() {
  var box = document.getElementById("agent-cards-box");
  if (!box) return;
  var q = (document.getElementById("q-filter") ? document.getElementById("q-filter").value : "").trim().toLowerCase();

  var filtered = [];
  for (var i = 0; i < allApps.length; i++) {
    var a = allApps[i];

    if (activeBranch === "queue" && (a.assigned_agent || a.status !== "Pending Review")) continue;
    if (activeBranch === "claimed" && !(a.assigned_agent === currentAgent.email && (a.status === "Pending Review" || a.status === "Under Agent Review" || a.status === "Encoding"))) continue;
    if (activeBranch === "correction" && a.status !== "Needs Correction" && !a.has_correction) continue;
    if (activeBranch === "encoded" && !isEncodedOrApproved(a)) continue;

    if (q) {
      var hay = ((a.full_name || "") + " " + (a.reference_no || "") + " " + (a.city || "") + " " + (a.email || "")).toLowerCase();
      if (hay.indexOf(q) === -1) continue;
    }
    filtered.push(a);
  }

  if (filtered.length === 0) {
    box.innerHTML = '<div class="card muted" style="text-align:center; padding:28px">No applications in this view right now.</div>';
    return;
  }

  var html = "";
  for (var j = 0; j < filtered.length; j++) {
    var app = filtered[j];
    var isClaimedByMe = app.assigned_agent === currentAgent.email;
    var claimBtn = "";

    if (!app.assigned_agent) {
      claimBtn = '<button type="button" class="btn btn-red btn-sm" onclick="claimApplication(\'' + escapeHtml(app.id) + '\')">Claim</button>';
    } else if (isClaimedByMe) {
      claimBtn = '<span class="badge badge-blue">Claimed by You</span>';
    } else {
      claimBtn = '<span class="badge badge-gray">Assigned: ' + escapeHtml(app.assigned_agent) + '</span>';
    }

    var locText = [app.barangay, app.city, app.province].filter(Boolean).join(", ");

    html +=
      '<div class="q-card">' +
        '<div class="q-head">' +
          '<div style="min-width:0; flex:1">' +
            '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">' +
              '<span class="q-name">' + escapeHtml(app.full_name) + '</span>' +
              '<span class="badge badge-gray" style="font-weight:700">' + escapeHtml(app.reference_no) + '</span>' +
              statusBadge(app.status) +
            '</div>' +
            '<div class="q-sub" style="margin-top:4px">' +
              '<b>' + escapeHtml(app.plan_name || "Red Fiber Plan") + '</b>' +
              (locText ? ' &bull; ' + escapeHtml(locText) : '') +
              ' &bull; Submitted ' + formatDate(app.created_at) +
            '</div>' +
            '<div style="margin-top:8px; display:flex; gap:6px; align-items:center; flex-wrap:wrap">' +
              getScreeningCardBadge(app) +
              (app.cropped_id_url ? '<span class="badge badge-green">Cropped ID Ready</span>' : '') +
              (app.has_correction ? '<span class="badge badge-blue">Customer Resubmitted</span>' : '') +
            '</div>' +
          '</div>' +
          '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">' +
            '<button type="button" class="btn btn-outline btn-sm" onclick="toggleCardMore(\'more-' + escapeHtml(app.id) + '\')">Summary</button>' +
            '<button type="button" class="btn btn-outline btn-sm" style="font-weight:700" onclick="openAppDetail(\'' + escapeHtml(app.id) + '\')">Open &amp; Verify</button>' +
            claimBtn +
          '</div>' +
        '</div>' +
        '<div id="more-' + escapeHtml(app.id) + '" class="q-more hidden">' +
          '<div><b>Screening Note:</b> ' + getScreeningQuickSummary(app) + '</div>' +
          '<div style="margin-top:4px" class="small muted"><b>Contact:</b> ' + escapeHtml(app.email || "-") + ' | ' + escapeHtml(app.phone || "-") + '</div>' +
        '</div>' +
      '</div>';
  }
  box.innerHTML = html;
}

function toggleCardMore(elId) {
  var el = document.getElementById(elId);
  if (el) el.classList.toggle("hidden");
}

async function claimApplication(appId) {
  var app = findAppById(appId);
  var keepCorrection = app && app.status === "Needs Correction";
  await dbUpdateApplication(appId, {
    assigned_agent: currentAgent.email,
    status: keepCorrection ? "Needs Correction" : "Under Agent Review"
  });
  if (app) {
    await dbAddAiLog(app.id, app.reference_no, "Agent (" + currentAgent.full_name + ")", "Claimed application from queue.");
    await dbAddLog(currentAgent.email, "Claimed application " + app.reference_no);
  }
  await refreshAgentData();
  showTab(keepCorrection ? "correction" : "claimed");
}

function findAppById(id) {
  for (var i = 0; i < allApps.length; i++) {
    if (allApps[i].id === id) return allApps[i];
  }
  return null;
}

async function openAppDetail(appId) {
  activeDetailAppId = appId;
  activeCopyMode = "latest";
  var app = findAppById(appId);
  activeIdImgMode = (app && app.cropped_id_url) ? "cropped" : "raw";
  pendingProofDataUrl = "";
  await renderDetailModalContent();
  document.getElementById("app-detail-modal").classList.remove("hidden");
}

function closeDetailModal() {
  document.getElementById("app-detail-modal").classList.add("hidden");
}

function switchCopyMode(mode) {
  activeCopyMode = mode;
  renderDetailModalContent();
}

function switchIdImgMode(mode) {
  activeIdImgMode = mode;
  renderDetailModalContent();
}

async function renderDetailModalContent() {
  var app = findAppById(activeDetailAppId);
  if (!app) return;

  document.getElementById("det-title").textContent = app.reference_no + " - " + app.full_name;
  var viewData = (activeCopyMode === "original" && app.original_submission) ? app.original_submission : app;
  var scr = app.screening || {};
  var res = app.ai_result || {};
  var isManualFallback = (!isAiEnabled() || !isScreeningServiceOnline || scr.state === "unavailable" || scr.state === "paused" || scr.fallback_original_only);

  var topScreeningBanner = "";
  if (isManualFallback) {
    topScreeningBanner =
      '<div class="status-banner warn" style="margin-bottom:14px">' +
        '<div><b>Manual Document Review Active:</b> Auto-screening is currently not active for this submission. The customer\'s <b>Original Uploaded ID Photos</b> are ready below for manual verification.</div>' +
        '<span class="badge badge-yellow">Original Copy Ready</span>' +
      '</div>';
  } else {
    var etaTxt = formatEtaLabel(scr.eta_seconds);
    if (scr.state === "queued" || scr.state === "layer1_running") {
      topScreeningBanner =
        '<div class="status-banner info" style="margin-bottom:14px">' +
          '<div><b>Screening in Progress ' + (etaTxt ? "(" + escapeHtml(etaTxt) + ")" : "") + ':</b> ' +
          escapeHtml(scr.phase || "Analyzing application and reading ID details") + '. ' +
          'The customer\'s original submission is already visible below if you wish to inspect it now.</div>' +
          '<span class="badge badge-blue">In Progress</span>' +
        '</div>';
    } else if (scr.state === "layer2_running") {
      var bannerTone = scr.severity === "warning" ? "warn" : "info";
      topScreeningBanner =
        '<div class="status-banner ' + bannerTone + '" style="margin-bottom:14px">' +
          '<div><b>' + (scr.severity === "warning" ? "Hold Recommended " : "Cropping &amp; Enhancing Document ") +
          (etaTxt ? "(" + escapeHtml(etaTxt) + ")" : "") + ':</b> ' +
          escapeHtml(scr.advisory || "Completing document cropping and verification...") + '</div>' +
          '<span class="badge ' + (scr.severity === "warning" ? "badge-yellow" : "badge-blue") + '">Layer 2</span>' +
        '</div>';
    } else if (scr.auto_correction_sent) {
      topScreeningBanner =
        '<div class="status-banner warn" style="margin-bottom:14px">' +
          '<div><b>Automatic Customer Update Requested:</b> Screening flagged a simple mismatch (<b>' +
          escapeHtml(scr.auto_correction_reason || "detail mismatch with Valid ID") +
          '</b>) and automatically sent a polite update notice to the customer.</div>' +
          '<span class="badge badge-yellow">Awaiting Customer</span>' +
        '</div>';
    }
  }

  var logs = await dbListAiLogs(app.id);
  var logItemsHtml = "";
  for (var i = 0; i < logs.length; i++) {
    var item = logs[i];
    logItemsHtml +=
      '<div class="chat-item">' +
        '<div class="who">' + escapeHtml(cleanScreeningText(item.actor)) + ' &bull; <span class="muted" style="font-weight:400">' + formatDate(item.created_at) + '</span></div>' +
        '<div>' + escapeHtml(cleanScreeningText(item.message)) + '</div>' +
      '</div>';
  }
  if (!logItemsHtml) {
    logItemsHtml = '<div class="small muted">No activity log entries recorded yet.</div>';
  }

  var docQualityLabel = isManualFallback
    ? "Manual Check"
    : (res.readability || (Number(res.blur_score) < 60 ? "Needs Check" : "Clear"));
  var nameCheckBadge = isManualFallback
    ? '<span class="badge badge-gray">Verify Manually</span>'
    : (res.name_match === false ? '<span class="badge badge-red">Mismatch</span>' : '<span class="badge badge-green">Matched</span>');
  var bdateCheckBadge = isManualFallback
    ? '<span class="badge badge-gray">Verify Manually</span>'
    : (res.birth_date_match === false ? '<span class="badge badge-red">Mismatch</span>' : '<span class="badge badge-green">Matched</span>');
  var idNoCheckBadge = isManualFallback
    ? '<span class="badge badge-gray">Verify Manually</span>'
    : (res.id_number_match === false ? '<span class="badge badge-red">Mismatch</span>' : '<span class="badge badge-green">Matched</span>');
  var findingsText = isManualFallback
    ? "Please inspect the customer's original uploaded ID photos and match them with Section 1."
    : ((res.issues && res.issues.length) ? cleanScreeningText(res.issues.join("; ")) : "No document issues flagged.");

  var copySwitcher = "";
  if (app.original_submission) {
    copySwitcher =
      '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap">' +
        '<span class="small muted">Version:</span>' +
        '<button type="button" class="btn btn-sm ' + (activeCopyMode === "latest" ? "btn-red" : "btn-outline") + '" style="padding:3px 10px; font-size:12px" onclick="switchCopyMode(\'latest\')">Latest Copy</button>' +
        '<button type="button" class="btn btn-sm ' + (activeCopyMode === "original" ? "btn-red" : "btn-outline") + '" style="padding:3px 10px; font-size:12px" onclick="switchCopyMode(\'original\')">Original Submission</button>' +
      '</div>';
  }

  var rawFrontUrl = viewData.id_image_url || app.id_image_url || app.id_front_path || "assets/images/logo.png";
  var croppedUrl = (activeCopyMode === "latest" && app.cropped_id_url) ? app.cropped_id_url : "";
  var displayedFrontUrl = (croppedUrl && activeIdImgMode === "cropped") ? croppedUrl : rawFrontUrl;
  var idBackPhotoUrl = viewData.id_back_path || app.id_back_path || "";

  var idModeBar = "";
  if (croppedUrl) {
    idModeBar =
      '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap">' +
        '<button type="button" class="btn btn-sm ' + (activeIdImgMode === "cropped" ? "btn-red" : "btn-outline") + '" style="padding:3px 10px; font-size:12px" onclick="switchIdImgMode(\'cropped\')">Cropped &amp; Enhanced Copy</button>' +
        '<button type="button" class="btn btn-sm ' + (activeIdImgMode === "raw" ? "btn-red" : "btn-outline") + '" style="padding:3px 10px; font-size:12px" onclick="switchIdImgMode(\'raw\')">Original Uploaded Photo</button>' +
      '</div>';
  } else {
    idModeBar = '<span class="badge badge-gray">Original Uploaded Copy</span>';
  }

  var currentSt = app.status || "Under Agent Review";
  var selectedReqStatus = (currentSt === "Approved" || currentSt === "Rejected" || currentSt === "Encoding" || currentSt === "Under Agent Review")
    ? currentSt
    : "Encoding";
  var isCorrectionOpen = (currentSt === "Needs Correction") ? " open" : "";
  var displayEmail = (activeCopyMode === "latest" && app.corrected_copy && app.corrected_copy.contact_email)
    ? app.corrected_copy.contact_email
    : (viewData.email || app.email);

  document.getElementById("det-body").innerHTML =
    topScreeningBanner +

    '<div class="grid-4" style="margin-bottom:14px">' +
      '<div class="card" style="padding:10px 14px"><div class="tiny muted">Internal Status</div><div style="margin-top:4px">' + statusBadge(app.status) + '</div></div>' +
      '<div class="card" style="padding:10px 14px"><div class="tiny muted">Customer Sees</div><div style="margin-top:4px">' + customerStatusBadge(app.status) + '</div></div>' +
      '<div class="card" style="padding:10px 14px"><div class="tiny muted">Selected Plan</div><div style="margin-top:4px; font-weight:700; font-size:13.5px">' + escapeHtml(app.plan_name || "-") + '</div></div>' +
      '<div class="card" style="padding:10px 14px"><div class="tiny muted">Assigned Agent</div><div style="margin-top:4px; font-weight:700; font-size:13px">' + escapeHtml(app.assigned_agent || "Unclaimed") + '</div></div>' +
    '</div>' +

    '<div class="section-card">' +
      '<div class="section-head">' +
        '<div class="section-head-title"><span class="step-badge">1</span>Applicant Profile &amp; Installation Address</div>' +
        copySwitcher +
      '</div>' +
      '<div class="grid-2" style="align-items:start">' +
        '<div>' +
          '<div class="tiny muted" style="font-weight:700; text-transform:uppercase; margin-bottom:6px">Personal &amp; ID Details</div>' +
          '<div class="kv">' +
            '<div><span>Full Name</span><b>' + escapeHtml(viewData.full_name || app.full_name) + '</b></div>' +
            '<div><span>Birth Date</span><b>' + escapeHtml(viewData.birth_date || app.birth_date || "-") + '</b></div>' +
            '<div><span>Email Address</span><b>' + escapeHtml(displayEmail || "-") + '</b></div>' +
            '<div><span>Mobile Number</span><b>' + escapeHtml(viewData.phone || app.phone || "-") + '</b></div>' +
            '<div><span>Valid ID Type</span><b>' + escapeHtml(viewData.id_type || app.id_type || "-") + '</b></div>' +
            '<div><span>Primary ID Number</span><b>' + escapeHtml(viewData.id_number || app.id_number || "-") + '</b></div>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="tiny muted" style="font-weight:700; text-transform:uppercase; margin-bottom:6px">Installation Location</div>' +
          '<div class="kv">' +
            '<div><span>House / Bldg / Street</span><b>' + escapeHtml(((app.house_no ? app.house_no + " " : "") + (app.building_name && app.building_name !== "N/A" ? app.building_name + " " : "") + (viewData.street || app.street || "")).trim() || "-") + '</b></div>' +
            '<div><span>Subdivision &amp; Brgy</span><b>' + escapeHtml([app.subdivision, app.barangay].filter(Boolean).join(", ") || "-") + '</b></div>' +
            '<div><span>City &amp; Province</span><b>' + escapeHtml([app.city, app.province].filter(Boolean).join(", ") || "-") + '</b></div>' +
            '<div><span>Nearest Landmark</span><b>' + escapeHtml(app.landmark || "-") + '</b></div>' +
            '<div><span>Pinned Coordinates</span><b>' + escapeHtml((app.latitude != null ? app.latitude : "-") + ", " + (app.longitude != null ? app.longitude : "-")) + '</b></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="section-card">' +
      '<div class="section-head">' +
        '<div class="section-head-title"><span class="step-badge">2</span>Valid ID Photos &amp; Document Check</div>' +
        idModeBar +
      '</div>' +
      '<div class="grid-2" style="margin-bottom:12px">' +
        '<div style="border:1px solid var(--line); border-radius:10px; padding:10px; background:var(--soft); text-align:center">' +
          '<div style="font-size:11.5px; font-weight:700; margin-bottom:6px">' + (croppedUrl && activeIdImgMode === "cropped" ? "FRONT ID (CROPPED &amp; ENHANCED)" : "FRONT ID (ORIGINAL UPLOADED COPY)") + '</div>' +
          '<img src="' + escapeHtml(displayedFrontUrl) + '" alt="Front ID" style="max-height:185px; margin:0 auto; border-radius:6px; object-fit:contain; cursor:pointer" onclick="window.open(this.src, \'_blank\')" title="Click to open full size in new tab" />' +
        '</div>' +
        '<div style="border:1px solid var(--line); border-radius:10px; padding:10px; background:var(--soft); text-align:center">' +
          '<div style="font-size:11.5px; font-weight:700; margin-bottom:6px">BACK ID (ORIGINAL UPLOADED COPY)</div>' +
          (idBackPhotoUrl
            ? '<img src="' + escapeHtml(idBackPhotoUrl) + '" alt="Back ID" style="max-height:185px; margin:0 auto; border-radius:6px; object-fit:contain; cursor:pointer" onclick="window.open(this.src, \'_blank\')" title="Click to open full size in new tab" />'
            : '<span class="muted small" style="display:block; padding:54px 0">No Back ID uploaded</span>') +
        '</div>' +
      '</div>' +

      '<div class="check-pill-grid">' +
        '<div class="check-pill"><span>Document Readability</span><b>' + escapeHtml(docQualityLabel) + '</b></div>' +
        '<div class="check-pill"><span>Applicant Name</span>' + nameCheckBadge + '</div>' +
        '<div class="check-pill"><span>Birth Date</span>' + bdateCheckBadge + '</div>' +
        '<div class="check-pill"><span>ID Number</span>' + idNoCheckBadge + '</div>' +
      '</div>' +
      '<div class="small muted" style="margin-top:8px"><b>Summary Note:</b> ' + escapeHtml(findingsText) + '</div>' +

      '<details style="margin-top:10px; border-top:1px dashed var(--line); padding-top:8px">' +
        '<summary style="cursor:pointer; font-size:12.5px; font-weight:600; color:var(--muted)">View Activity Log (' + logs.length + ' entries)</summary>' +
        '<div class="chat-log" style="max-height:170px; overflow-y:auto; margin-top:8px">' + logItemsHtml + '</div>' +
      '</details>' +
    '</div>' +

    '<div class="section-card">' +
      '<div class="section-head">' +
        '<div class="section-head-title"><span class="step-badge">3</span>Application Status &amp; Validator Decision</div>' +
        '<span class="tiny muted">Customers only see Processing, Approved, or Rejected</span>' +
      '</div>' +
      '<div class="grid-3" style="margin-bottom:10px">' +
        '<div class="field" style="margin-bottom:0">' +
          '<label>Select Status</label>' +
          '<select id="det-status-select">' +
            '<option value="Under Agent Review" ' + (selectedReqStatus === "Under Agent Review" ? "selected" : "") + '>Under Agent Review (In Progress)</option>' +
            '<option value="Encoding" ' + (selectedReqStatus === "Encoding" ? "selected" : "") + '>Encoding (Forwarded to Validator)</option>' +
            '<option value="Approved" ' + (selectedReqStatus === "Approved" ? "selected" : "") + '>Approved (Validator Decision)</option>' +
            '<option value="Rejected" ' + (selectedReqStatus === "Rejected" ? "selected" : "") + '>Rejected (Validator Decision)</option>' +
          '</select>' +
        '</div>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label>Validator Reference # (Optional)</label>' +
          '<input id="det-provider-ref" type="text" placeholder="e.g. RF-10492" value="' + escapeHtml(app.provider_ref || "") + '" />' +
        '</div>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label>Encoding Proof Screenshot (Optional)</label>' +
          '<input type="file" accept="image/*" onchange="onEncodingProofPick(this)" />' +
          (app.encoding_proof_url ? '<div style="margin-top:4px"><span class="badge badge-green">Proof Attached</span></div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="field" style="margin-bottom:12px">' +
        '<label>Remarks / Note (Optional)</label>' +
        '<textarea id="det-remarks" rows="2" placeholder="Optional note for Approved / Rejected status (leave blank to use the standard polite message)...">' + escapeHtml(currentSt !== "Needs Correction" ? (app.agent_remarks || "") : "") + '</textarea>' +
      '</div>' +
      '<div class="row" style="justify-content:flex-end">' +
        '<button type="button" class="btn btn-red" onclick="saveSelectedStatus()">Save Status Update</button>' +
      '</div>' +
    '</div>' +

    '<details' + isCorrectionOpen + ' class="section-card" style="background:var(--soft)">' +
      '<summary style="cursor:pointer; font-weight:700; font-size:14.5px; color:var(--text); display:flex; align-items:center; gap:8px">' +
        '<span class="step-badge" style="background:#d97706">4</span>' +
        '<span>Optional: Request Customer Update (Needs Correction)</span>' +
      '</summary>' +
      '<div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--line)">' +
        '<p class="muted" style="font-size:12.5px; margin-bottom:12px">Use this section when the customer needs to correct a detail or upload a clearer ID photo. An email notification and portal alert will be sent automatically.</p>' +

        '<div class="grid-2" style="margin-bottom:10px">' +
          '<div class="field" style="margin-bottom:0">' +
            '<label>Field for Customer to Update</label>' +
            '<select id="det-correction-field">' +
              '<option value="auto">Auto-Detect Field</option>' +
              '<option value="name" ' + ((app.correction_fields || []).join(",") === "name" ? "selected" : "") + '>Applicant Name</option>' +
              '<option value="birth_date" ' + ((app.correction_fields || []).join(",") === "birth_date" ? "selected" : "") + '>Birth Date</option>' +
              '<option value="id_photo" ' + ((app.correction_fields || []).join(",") === "id_photo" ? "selected" : "") + '>Valid ID Photo</option>' +
              '<option value="id_number" ' + ((app.correction_fields || []).join(",") === "id_number" ? "selected" : "") + '>Primary ID Number</option>' +
              '<option value="email" ' + ((app.correction_fields || []).join(",") === "email" ? "selected" : "") + '>Email Address</option>' +
              '<option value="phone" ' + ((app.correction_fields || []).join(",") === "phone" ? "selected" : "") + '>Mobile Number</option>' +
              '<option value="email_or_phone" ' + ((app.correction_fields || []).join(",") === "email,phone" ? "selected" : "") + '>Both Email &amp; Mobile</option>' +
              '<option value="address" ' + ((app.correction_fields || []).join(",") === "address" ? "selected" : "") + '>Installation Address</option>' +
            '</select>' +
          '</div>' +
          '<div class="field" style="margin-bottom:0">' +
            '<label>Quick Preset Reason (Optional)</label>' +
            '<select id="det-preset-select" onchange="onValidatorPresetChange(this.value)">' +
              renderValidatorPresetOptions() +
            '</select>' +
          '</div>' +
        '</div>' +

        '<div class="field" style="margin-bottom:10px">' +
          '<label>Short Review / Validator Note (Optional)</label>' +
          '<input id="det-validator-raw" type="text" value="' + escapeHtml(app.validator_raw_remark || "") + '" placeholder="e.g. Blurry ID photo or duplicate email in provider portal..." />' +
        '</div>' +

        '<div class="field" style="margin-bottom:12px">' +
          '<div class="row between" style="margin-bottom:4px">' +
            '<label style="margin:0">Polite Message Shown to Customer</label>' +
            '<button type="button" id="btn-polite-gen" class="btn btn-outline btn-sm" style="padding:3px 10px; font-size:12px" onclick="convertValidatorToPoliteRemark()">Compose Polite Message</button>' +
          '</div>' +
          '<span id="polite-running-spinner" class="badge badge-blue" style="display:none; margin-bottom:6px">Composing message...</span>' +
          '<textarea id="det-correction-message" rows="2" placeholder="Select a preset above, click Compose Polite Message, or type a polite instruction for the customer...">' + escapeHtml(currentSt === "Needs Correction" ? (app.agent_remarks || "") : "") + '</textarea>' +
        '</div>' +

        '<div class="row" style="justify-content:flex-end">' +
          '<button type="button" class="btn btn-outline" style="border-color:#d97706; color:#b45309; font-weight:700" onclick="saveAgentDecision(\'Needs Correction\')">Send Update Request to Customer</button>' +
        '</div>' +
      '</div>' +
    '</details>';
}

function saveSelectedStatus() {
  var sel = document.getElementById("det-status-select");
  var chosen = sel ? sel.value : "Encoding";
  saveAgentDecision(chosen);
}

async function convertValidatorToPoliteRemark() {
  var rawEl = document.getElementById("det-validator-raw");
  var corrEl = document.getElementById("det-correction-message");
  var fieldEl = document.getElementById("det-correction-field");
  var btn = document.getElementById("btn-polite-gen");
  var spin = document.getElementById("polite-running-spinner");

  var rawText = (rawEl && rawEl.value.trim()) || (corrEl && corrEl.value.trim()) || "";
  var chosenField = fieldEl ? fieldEl.value : "auto";

  if (!rawText && chosenField === "auto") {
    showAlert("Note Needed", "Please select a field, choose a preset, or type a short note first so a polite customer message can be composed.");
    return null;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Composing...";
  }
  if (spin) spin.style.display = "inline-block";

  try {
    var res = await apiGeneratePoliteRemark(rawText || chosenField, chosenField);
    if (corrEl && res.polite_message) {
      corrEl.value = res.polite_message;
    }
    lastDetectedFields = res.target_fields || [];
    return res;
  } catch (err) {
    var fallbackLabel = FIELD_SUMMARY_LABELS[chosenField] || "application details";
    var localPolite = "Hello! While reviewing your application, we noticed that your " + fallbackLabel.toLowerCase() + " needs a quick update" + (rawText ? " (" + rawText + ")" : "") + ". Please sign in to your Customer Account to submit the updated information so we can continue processing.";
    if (corrEl) corrEl.value = localPolite;
    return { polite_message: localPolite, target_fields: chosenField !== "auto" ? [chosenField] : [] };
  } finally {
    if (spin) spin.style.display = "none";
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Compose Polite Message";
    }
  }
}

function onEncodingProofPick(inputEl) {
  var file = inputEl.files && inputEl.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    pendingProofDataUrl = reader.result;
  };
  reader.readAsDataURL(file);
}

async function saveAgentDecision(newStatus) {
  var app = findAppById(activeDetailAppId);
  if (!app) return;

  var rawValidator = document.getElementById("det-validator-raw") ? document.getElementById("det-validator-raw").value.trim() : "";
  var chosenField = document.getElementById("det-correction-field") ? document.getElementById("det-correction-field").value : "auto";
  var statusRemarks = document.getElementById("det-remarks") ? document.getElementById("det-remarks").value.trim() : "";
  var corrRemarks = document.getElementById("det-correction-message") ? document.getElementById("det-correction-message").value.trim() : "";
  var remarks = newStatus === "Needs Correction" ? (corrRemarks || statusRemarks) : statusRemarks;
  var providerRef = document.getElementById("det-provider-ref") ? document.getElementById("det-provider-ref").value.trim() : (app.provider_ref || "");
  var isEncoded = (newStatus === "Encoding" || newStatus === "Approved");

  var targetFields = lastDetectedFields || [];
  if (chosenField === "email") targetFields = ["email"];
  else if (chosenField === "phone") targetFields = ["phone"];
  else if (chosenField === "email_or_phone") targetFields = ["email", "phone"];
  else if (chosenField !== "auto") targetFields = [chosenField];

  if ((newStatus === "Encoding" || newStatus === "Under Agent Review") && !remarks) {
    remarks = "Your application is currently being processed.";
  } else if (newStatus === "Approved" && !remarks) {
    remarks = "Your application has been approved. Please wait 3-5 business days for installation dispatch.";
  } else if (newStatus === "Rejected" && !remarks) {
    remarks = rawValidator || "Your application could not be approved following validation.";
  } else if (newStatus === "Needs Correction" && !remarks) {
    if (rawValidator || chosenField !== "auto") {
      var gen = await convertValidatorToPoliteRemark();
      if (gen && gen.polite_message) {
        remarks = gen.polite_message;
        targetFields = gen.target_fields || targetFields;
      }
    }
    if (!remarks) {
      remarks = rawValidator || "Please review your application details and submit the requested update in your Customer Account.";
    }
  }

  var proofUrl = pendingProofDataUrl || app.encoding_proof_url || "";
  var updatedScreening = Object.assign({}, app.screening || {}, {
    correction_fields: newStatus === "Needs Correction" ? targetFields : [],
    auto_correction_sent: false,
    validator_raw_remark: rawValidator
  });

  await dbUpdateApplication(app.id, {
    status: newStatus,
    assigned_agent: currentAgent.email,
    agent_remarks: remarks,
    correction_note: remarks,
    customer_instruction: remarks,
    screening: updatedScreening,
    encoded: isEncoded,
    provider_ref: providerRef,
    encoding_proof_url: proofUrl
  });

  lastDetectedFields = null;

  await dbAddAiLog(
    app.id,
    app.reference_no,
    "Agent (" + currentAgent.full_name + ")",
    "Updated status to " + newStatus + (providerRef ? " (Ref: " + providerRef + ")" : "") + " - " + remarks
  );

  var emailNoticeNote = "";
  if (newStatus === "Approved" || newStatus === "Rejected" || newStatus === "Needs Correction") {
    var custTitle = newStatus === "Needs Correction"
      ? "Update Needed for Application (" + app.reference_no + ")"
      : "Application " + newStatus + " (" + app.reference_no + ")";
    var targetSummaryLabel = FIELD_SUMMARY_LABELS[chosenField] || (rawValidator ? rawValidator : "Information / Document Clarification");
    var recipientEmail = (app.corrected_copy && app.corrected_copy.contact_email) || app.email;

    await dbAddNotification(recipientEmail, "customer", custTitle, remarks);
    var mailRes = await apiSendStatusEmail(recipientEmail, app.full_name, app.reference_no, newStatus, remarks, targetSummaryLabel);
    if (mailRes && mailRes.sent) {
      emailNoticeNote = " Email notification sent to " + recipientEmail + ".";
    }
  }

  await dbAddLog(currentAgent.email, "Set application " + app.reference_no + " status to " + newStatus);

  closeDetailModal();
  await refreshAgentData();
  showAlert("Status Updated", "Application " + app.reference_no + " is now marked as " + newStatus + "." + emailNoticeNote);
}

function downloadApplicantId() {
  var app = findAppById(activeDetailAppId);
  if (!app) return;
  var url = (activeIdImgMode === "cropped" && app.cropped_id_url)
    ? app.cropped_id_url
    : (app.id_image_url || app.id_front_path || "assets/images/logo.png");
  var suffix = (activeIdImgMode === "cropped" && app.cropped_id_url) ? "-ID-Cropped.jpg" : "-ID.png";
  var a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.download = (app.reference_no || "applicant") + suffix;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function printApplicantCopy() {
  window.print();
}

async function createNewAgentLink() {
  var note = document.getElementById("link-note").value.trim() || "Walk-in / Assisted Customer";
  await dbCreateAgentLink(currentAgent.email, note);
  document.getElementById("link-note").value = "";
  await renderAgentLinks();
}

async function renderAgentLinks() {
  var body = document.getElementById("agent-links-body");
  if (!body) return;
  var links = await dbListAgentLinks();
  if (links.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="muted">No links generated yet.</td></tr>';
    return;
  }
  var baseUrl = window.location.origin + window.location.pathname.replace("agent.html", "apply.html");
  var html = "";
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    var fullUrl = baseUrl + "?ref=" + encodeURIComponent(l.code);
    html +=
      '<tr>' +
        '<td><b>' + escapeHtml(l.code) + '</b></td>' +
        '<td>' + escapeHtml(l.note) + '</td>' +
        '<td><input type="text" readonly value="' + escapeHtml(fullUrl) + '" style="font-size:12px; padding:5px 8px" /></td>' +
        '<td>' + formatDate(l.created_at) + '</td>' +
        '<td><button type="button" class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText(\'' + escapeHtml(fullUrl) + '\'); showAlert(\'Copied\', \'Application link copied to clipboard!\')">Copy URL</button></td>' +
      '</tr>';
  }
  body.innerHTML = html;
}
