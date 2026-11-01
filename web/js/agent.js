var currentAgent = null;
var allApps = [];
var activeBranch = "overview";
var activeDetailAppId = null;
var activeCopyMode = "latest";
var activeIdImgMode = "cropped";
var pendingProofDataUrl = "";
var lastDetectedFields = null;

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
  var remEl = document.getElementById("det-remarks");

  if (rawEl) rawEl.value = p.raw;
  if (fieldEl) fieldEl.value = p.field;
  if (remEl) remEl.value = p.msg;
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
  await refreshAgentData();
  initDashUI(currentAgent, allApps, openAppDetail);

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
  if (!isAiEnabled()) {
    return '<span class="badge badge-gray">Manual Review</span>';
  }
  var scr = app.screening || {};
  var state = scr.state || "";
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
  if (!isAiEnabled()) {
    return '<span class="muted">Automated screening paused - manual document review active.</span>';
  }
  var scr = app.screening || {};
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
      claimBtn = '<span class="badge badge-gray">Agent: ' + escapeHtml(app.assigned_agent) + '</span>';
    }

    html +=
      '<div class="q-card">' +
        '<div class="q-head">' +
          '<div>' +
            '<div class="q-name">' + escapeHtml(app.full_name) + ' <span class="muted" style="font-weight:500; font-size:12px">(' + escapeHtml(app.reference_no) + ')</span></div>' +
            '<div class="q-sub" style="margin-top:6px; display:flex; gap:8px; align-items:center; flex-wrap:wrap">' +
              statusBadge(app.status) +
              getScreeningCardBadge(app) +
              (app.cropped_id_url ? '<span class="badge badge-gray">Cropped ID Ready</span>' : '') +
              (app.has_correction ? '<span class="badge badge-blue">Updated Copy Submitted</span>' : '') +
              '<button type="button" class="btn btn-outline btn-sm" style="padding:2px 8px; font-size:11px" onclick="toggleCardMore(\'more-' + escapeHtml(app.id) + '\')"> Quick Info</button>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex; gap:8px; align-items:center">' +
            '<button type="button" class="btn btn-outline btn-sm" onclick="openAppDetail(\'' + escapeHtml(app.id) + '\')">Open Application</button>' +
            claimBtn +
          '</div>' +
        '</div>' +
        '<div id="more-' + escapeHtml(app.id) + '" class="q-more hidden">' +
          '<div><b>Plan:</b> ' + escapeHtml(app.plan_name) + ' - <b>Location:</b> ' + escapeHtml((app.barangay || "") + ", " + (app.city || "") + ", " + (app.province || "")) + '</div>' +
          '<div style="margin-top:4px"><b>Screening:</b> ' + getScreeningQuickSummary(app) + '</div>' +
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

  var topScreeningBanner = "";
  if (isAiEnabled()) {
    var etaTxt = formatEtaLabel(scr.eta_seconds);
    if (scr.state === "queued" || scr.state === "layer1_running") {
      topScreeningBanner =
        '<div class="msg info show" style="margin-bottom:14px">' +
          '<b>Screening in Progress ' + (etaTxt ? "(" + escapeHtml(etaTxt) + ")" : "") + ':</b> ' +
          escapeHtml(scr.phase || "Analyzing application and reading ID details") + '.<br>' +
          '<span style="font-size:12.5px">The customer\'s original submission is already visible below if you wish to inspect or forward it now, or you may wait a few moments for full screening and cropping to complete.</span>' +
        '</div>';
    } else if (scr.state === "layer2_running") {
      var warnStyle = scr.severity === "warning" ? "error" : "info";
      topScreeningBanner =
        '<div class="msg ' + warnStyle + ' show" style="margin-bottom:14px">' +
          '<b>' + (scr.severity === "warning" ? "Hold Recommended - Document Enhancement in Progress " : "Cropping &amp; Enhancing Document ") +
          (etaTxt ? "(" + escapeHtml(etaTxt) + ")" : "") + ':</b><br>' +
          escapeHtml(scr.advisory || "Completing document cropping and verification...") +
          '<div style="font-size:12px; margin-top:4px">Original submitted details and photos are shown below if you still choose to proceed early.</div>' +
        '</div>';
    } else if (scr.auto_correction_sent) {
      topScreeningBanner =
        '<div class="msg info show" style="margin-bottom:14px; border-left:4px solid #d97706">' +
          '<b>Automatic Customer Update Requested:</b><br>' +
          'Screening detected a simple mismatch (<b>' + escapeHtml(scr.auto_correction_reason || "detail mismatch with Valid ID") + '</b>) and automatically notified the customer to submit an updated entry. No manual correction request was needed from you.' +
        '</div>';
    }
  }

  var logs = await dbListAiLogs(app.id);
  var logHtml = "";
  if (!isAiEnabled()) {
    logHtml = '<div class="msg info show"><b>Manual Review Mode:</b> Automated screening is currently paused. Review the submitted details and ID below.</div>';
  } else {
    var docQualityLabel = res.readability || (Number(res.blur_score) < 60 ? "Blurry / Needs Check" : "Clear");
    var findingsText = (res.issues && res.issues.length) ? cleanScreeningText(res.issues.join("; ")) : "No document issues flagged.";
    logHtml +=
      '<div class="chat-item ai">' +
        '<div class="who">Screening Summary (' + escapeHtml(res.overall_status || (isScreeningActiveOnApp(app) ? "In Progress" : "Checked")) + ')</div>' +
        '<div>Document Quality: <b>' + escapeHtml(docQualityLabel) + '</b> - Name Match: <b>' + (res.name_match === false ? "Mismatch" : "Matched") + '</b> - ID No. Match: <b>' + (res.id_number_match === false ? "Mismatch" : "Matched") + '</b></div>' +
        '<div class="muted" style="font-size:12px; margin-top:4px">' + escapeHtml(findingsText) + '</div>' +
      '</div>';
    for (var i = 0; i < logs.length; i++) {
      var item = logs[i];
      logHtml +=
        '<div class="chat-item">' +
          '<div class="who">' + escapeHtml(cleanScreeningText(item.actor)) + ' - <span class="muted" style="font-weight:400">' + formatDate(item.created_at) + '</span></div>' +
          '<div>' + escapeHtml(cleanScreeningText(item.message)) + '</div>' +
        '</div>';
    }
  }

  var copySwitcher = "";
  if (app.original_submission) {
    copySwitcher =
      '<div style="display:flex; gap:8px; margin-bottom:14px; padding:10px; background:var(--soft); border-radius:8px; align-items:center">' +
        '<b style="font-size:12px">Submission Version:</b>' +
        '<button type="button" class="btn btn-sm ' + (activeCopyMode === "latest" ? "btn-red" : "btn-outline") + '" onclick="switchCopyMode(\'latest\')">Latest Copy</button>' +
        '<button type="button" class="btn btn-sm ' + (activeCopyMode === "original" ? "btn-red" : "btn-outline") + '" onclick="switchCopyMode(\'original\')">Original Submission</button>' +
      '</div>';
  }

  var rawFrontUrl = viewData.id_image_url || app.id_image_url || app.id_front_path || "assets/images/logo.png";
  var croppedUrl = (activeCopyMode === "latest" && app.cropped_id_url) ? app.cropped_id_url : "";
  var displayedFrontUrl = (croppedUrl && activeIdImgMode === "cropped") ? croppedUrl : rawFrontUrl;
  var idBackPhotoUrl = viewData.id_back_path || app.id_back_path || "";

  var idModeBar = "";
  if (croppedUrl) {
    idModeBar =
      '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center; flex-wrap:wrap">' +
        '<span class="small muted" style="font-weight:600">Front ID View:</span>' +
        '<button type="button" class="btn btn-sm ' + (activeIdImgMode === "cropped" ? "btn-red" : "btn-outline") + '" style="padding:3px 10px; font-size:11.5px" onclick="switchIdImgMode(\'cropped\')">Cropped &amp; Enhanced Copy</button>' +
        '<button type="button" class="btn btn-sm ' + (activeIdImgMode === "raw" ? "btn-red" : "btn-outline") + '" style="padding:3px 10px; font-size:11.5px" onclick="switchIdImgMode(\'raw\')">Original Uploaded Photo</button>' +
      '</div>';
  }

  var currentSt = app.status || "Encoding";
  var selectedReqStatus = (currentSt === "Approved" || currentSt === "Rejected" || currentSt === "Encoding") ? currentSt : "Encoding";
  var isCorrectionOpen = (currentSt === "Needs Correction") ? " open" : "";

  document.getElementById("det-body").innerHTML =
    topScreeningBanner +
    copySwitcher +
    '<div class="grid-2" style="align-items:start">' +
      '<div>' +
        '<h3 style="margin-bottom:8px">Applicant &amp; Service Address</h3>' +
        '<div class="kv">' +
          '<div><span>Staff Status</span><b>' + statusBadge(app.status) + '</b></div>' +
          '<div><span>Customer Sees</span><b>' + customerStatusBadge(app.status) + '</b></div>' +
          '<div><span>Selected Plan</span><b>' + escapeHtml(app.plan_name) + '</b></div>' +
          '<div><span>Full Name</span><b>' + escapeHtml(viewData.full_name || app.full_name) + '</b></div>' +
          '<div><span>Birth Date</span><b>' + escapeHtml(viewData.birth_date || app.birth_date || "-") + '</b></div>' +
          '<div><span>Email</span><b>' + escapeHtml((activeCopyMode === "latest" && app.corrected_copy && app.corrected_copy.contact_email) ? app.corrected_copy.contact_email : (viewData.email || app.email)) + '</b></div>' +
          '<div><span>Primary Mobile</span><b>' + escapeHtml(viewData.phone || app.phone) + '</b></div>' +
          '<div><span>Primary ID Type</span><b>' + escapeHtml(viewData.id_type || app.id_type) + '</b></div>' +
          '<div><span>Primary ID Number</span><b>' + escapeHtml(viewData.id_number || app.id_number) + '</b></div>' +
          '<div><span>Building / Street</span><b>' + escapeHtml((app.building_name || "") + " " + (viewData.street || app.street || "")) + '</b></div>' +
          '<div><span>Subdivision / Brgy</span><b>' + escapeHtml((app.subdivision || "") + ", " + (app.barangay || "")) + '</b></div>' +
          '<div><span>City / Province</span><b>' + escapeHtml((app.city || "") + ", " + (app.province || "")) + '</b></div>' +
          '<div><span>Nearest Landmark</span><b>' + escapeHtml(app.landmark || "-") + '</b></div>' +
          '<div><span>Pinned Coordinates</span><b>' + escapeHtml(app.latitude + ", " + app.longitude) + '</b></div>' +
        '</div>' +
      '</div>' +

      '<div>' +
        '<h3 style="margin-bottom:8px">Submitted Valid ID Photos</h3>' +
        idModeBar +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px">' +
          '<div style="border:1px solid var(--line); border-radius:8px; padding:6px; background:var(--soft); text-align:center">' +
            '<div style="font-size:11px; font-weight:700; margin-bottom:4px">' + (croppedUrl && activeIdImgMode === "cropped" ? "FRONT ID (CROPPED COPY)" : "FRONT ID (ORIGINAL)") + '</div>' +
            '<img src="' + escapeHtml(displayedFrontUrl) + '" alt="Front ID" style="max-height:165px; max-width:100%; border-radius:4px; object-fit:contain; cursor:pointer" onclick="window.open(this.src, \'_blank\')" title="Click to open full size" />' +
          '</div>' +
          '<div style="border:1px solid var(--line); border-radius:8px; padding:6px; background:var(--soft); text-align:center">' +
            '<div style="font-size:11px; font-weight:700; margin-bottom:4px">BACK ID</div>' +
            (idBackPhotoUrl ? '<img src="' + escapeHtml(idBackPhotoUrl) + '" alt="Back ID" style="max-height:165px; max-width:100%; border-radius:4px; object-fit:contain; cursor:pointer" onclick="window.open(this.src, \'_blank\')" title="Click to open full size" />' : '<span class="muted small" style="display:block; padding:40px 0">No Back ID uploaded</span>') +
          '</div>' +
        '</div>' +

        '<h3 style="margin-bottom:8px">Screening &amp; Activity Log</h3>' +
        '<div class="chat-log" style="max-height:200px; overflow-y:auto">' + logHtml + '</div>' +
      '</div>' +
    '</div>' +

    '<div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--line)">' +
      '<h3 style="margin-bottom:4px">Application Status &amp; Validator Decision</h3>' +
      '<p class="muted" style="font-size:12.5px; margin-bottom:12px">Mark as <b>Encoding</b> when forwarded to the Validator, and record the Validator\'s decision (<b>Approved</b> or <b>Rejected</b>). <i>Note: Customers only see Processing, Approved, or Rejected.</i></p>' +

      '<div class="grid-3" style="margin-bottom:12px">' +
        '<div class="field" style="margin-bottom:0">' +
          '<label>Application Status *</label>' +
          '<select id="det-status-select">' +
            '<option value="Encoding" ' + (selectedReqStatus === "Encoding" ? "selected" : "") + '>Encoding (Forwarded to Validator)</option>' +
            '<option value="Approved" ' + (selectedReqStatus === "Approved" ? "selected" : "") + '>Approved (Per Validator)</option>' +
            '<option value="Rejected" ' + (selectedReqStatus === "Rejected" ? "selected" : "") + '>Rejected (Per Validator)</option>' +
          '</select>' +
        '</div>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label>Validator / Reference # (Optional)</label>' +
          '<input id="det-provider-ref" type="text" placeholder="e.g. RF-10492" value="' + escapeHtml(app.provider_ref || "") + '" />' +
        '</div>' +
        '<div class="field" style="margin-bottom:0">' +
          '<label>Encoding Screenshot (Optional)</label>' +
          '<input type="file" accept="image/*" onchange="onEncodingProofPick(this)" />' +
          (app.encoding_proof_url ? '<div style="margin-top:4px"><span class="badge badge-green">Proof Saved</span></div>' : '') +
        '</div>' +
      '</div>' +

      '<div class="field" style="margin-bottom:12px">' +
        '<label>Note / Remarks for Customer (Optional)</label>' +
        '<textarea id="det-remarks" rows="2" placeholder="Optional note (leave blank to use the standard message)...">' + escapeHtml(app.agent_remarks || "") + '</textarea>' +
      '</div>' +

      '<div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center">' +
        '<button type="button" class="btn btn-outline" style="border-color:#2563eb; color:#1d4ed8; font-weight:700" onclick="saveAgentDecision(\'Encoding\')">Set as Encoding</button>' +
        '<button type="button" class="btn btn-green" onclick="saveAgentDecision(\'Approved\')">Record Approved</button>' +
        '<button type="button" class="btn btn-red" onclick="saveAgentDecision(\'Rejected\')">Record Rejected</button>' +
        '<button type="button" class="btn btn-outline" style="margin-left:auto" onclick="saveSelectedStatus()">Save Selected Status</button>' +
      '</div>' +

      '<details' + isCorrectionOpen + ' style="margin-top:16px; border:1px solid var(--line); border-radius:8px; padding:10px 14px; background:var(--soft)">' +
        '<summary style="cursor:pointer; font-weight:700; font-size:13px; color:var(--text)">Optional: Request Customer Correction (Needs Correction)</summary>' +
        '<div style="margin-top:12px">' +
          '<p class="muted" style="font-size:12px; margin-bottom:10px">Simple mismatches (such as name or ID number) are already requested automatically during screening. Use this only if the Validator or your review requires another update from the customer.</p>' +

          '<div class="field" style="margin-bottom:10px">' +
            '<label>Quick Preset Remark (Optional)</label>' +
            '<select id="det-preset-select" onchange="onValidatorPresetChange(this.value)">' +
              renderValidatorPresetOptions() +
            '</select>' +
          '</div>' +

          '<div class="grid-2" style="margin-bottom:10px">' +
            '<div class="field" style="margin-bottom:0">' +
              '<label>Validator / Review Note</label>' +
              '<input id="det-validator-raw" type="text" value="' + escapeHtml(app.validator_raw_remark || "") + '" placeholder="e.g. Duplicate email in provider portal..." />' +
            '</div>' +
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
          '</div>' +

          '<div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center">' +
            '<button type="button" id="btn-polite-gen" class="btn btn-outline btn-sm" onclick="convertValidatorToPoliteRemark()">Generate Polite Message</button>' +
            '<span id="polite-running-spinner" class="badge badge-blue" style="display:none;">Composing message...</span>' +
            '<button type="button" class="btn btn-outline btn-sm" style="border-color:#d97706; color:#b45309; font-weight:700" onclick="saveAgentDecision(\'Needs Correction\')">Send Correction Request</button>' +
          '</div>' +
        '</div>' +
      '</details>' +
    '</div>';
}

function saveSelectedStatus() {
  var sel = document.getElementById("det-status-select");
  var chosen = sel ? sel.value : "Encoding";
  saveAgentDecision(chosen);
}

async function convertValidatorToPoliteRemark() {
  var rawEl = document.getElementById("det-validator-raw");
  var remEl = document.getElementById("det-remarks");
  var fieldEl = document.getElementById("det-correction-field");
  var btn = document.getElementById("btn-polite-gen");
  var spin = document.getElementById("polite-running-spinner");

  var rawText = (rawEl && rawEl.value.trim()) || (remEl && remEl.value.trim()) || "";
  var chosenField = fieldEl ? fieldEl.value : "auto";

  if (!rawText && chosenField === "auto") {
    showAlert("Note Needed", "Please type a short note or pick a preset first so a polite customer message can be composed.");
    return null;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Composing...";
  }
  if (spin) spin.style.display = "inline-block";

  try {
    var res = await apiGeneratePoliteRemark(rawText || chosenField, chosenField);
    if (remEl && res.polite_message) {
      remEl.value = res.polite_message;
    }
    lastDetectedFields = res.target_fields || [];
    return res;
  } catch (err) {
    showAlert("Service Busy", "Please select a preset above or type a short note directly in the remarks box.");
    return null;
  } finally {
    if (spin) spin.style.display = "none";
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Generate Polite Message";
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
  var remarks = document.getElementById("det-remarks") ? document.getElementById("det-remarks").value.trim() : "";
  var providerRef = document.getElementById("det-provider-ref") ? document.getElementById("det-provider-ref").value.trim() : (app.provider_ref || "");
  var isEncoded = (newStatus === "Encoding" || newStatus === "Approved");

  var targetFields = lastDetectedFields || [];
  if (chosenField === "email") targetFields = ["email"];
  else if (chosenField === "phone") targetFields = ["phone"];
  else if (chosenField === "email_or_phone") targetFields = ["email", "phone"];
  else if (chosenField !== "auto") targetFields = [chosenField];

  if (newStatus === "Encoding" && !remarks) {
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

  if (newStatus === "Approved" || newStatus === "Rejected" || newStatus === "Needs Correction") {
    var custTitle = newStatus === "Needs Correction"
      ? "Update Needed for Application (" + app.reference_no + ")"
      : "Application " + newStatus + " (" + app.reference_no + ")";
    await dbAddNotification(app.email, "customer", custTitle, remarks);
    await apiSendStatusEmail(app.email, app.full_name, app.reference_no, newStatus, remarks);
  }

  await dbAddLog(currentAgent.email, "Set application " + app.reference_no + " status to " + newStatus);

  closeDetailModal();
  await refreshAgentData();
  showAlert("Status Updated", "Application " + app.reference_no + " is now marked as " + newStatus + ".");
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
