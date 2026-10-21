// ============================================================
// AGENT WORKSPACE LOGIC (Application Handling Management)
// ============================================================

var currentAgent = null;
var allApps = [];
var activeBranch = "overview"; // "overview", "queue", "claimed", "correction", "encoded", "links"
var activeDetailAppId = null;
var activeCopyMode = "latest"; // "latest" or "original"
var pendingProofDataUrl = "";
var lastDetectedFields = null;

var VALIDATOR_PRESETS = [
  { label: "-- Quick Select Common / Rare Validator Remark --", raw: "", field: "auto", msg: "" },
  { label: "⚡ [COMMON] Duplicate Email in RADIUS", raw: "Duplicate email address in RADIUS portal", field: "email", msg: "We detected that your email address is already associated with an existing account in the RADIUS portal. Please provide an alternate active email address so we can proceed with your application." },
  { label: "⚡ [COMMON] Duplicate Mobile Number in RADIUS", raw: "Mobile number already exists in RADIUS provider system", field: "phone", msg: "The mobile number provided is already registered in the provider system. Please update your primary mobile number." },
  { label: "⚡ [COMMON] Both Email & Mobile Duplicate", raw: "Duplicate email and mobile number in subscriber database", field: "email_or_phone", msg: "Both your email and mobile number are already linked to an existing account. Please provide an alternate email and mobile number." },
  { label: "⚡ [COMMON] Blurry / Unreadable Valid ID", raw: "Uploaded valid ID photo is blurry, unreadable, or low resolution", field: "id_photo", msg: "Your uploaded valid ID is blurry and could not be clearly verified. Please upload a clear, high-resolution photo of your valid ID." },
  { label: "⚡ [COMMON] ID Lighting Glare / Flash", raw: "Lighting glare or flash reflection covering text/photo on valid ID", field: "id_photo", msg: "There is lighting glare or flash reflection covering details on your ID. Please take a photo in a well-lit room without flash." },
  { label: "⚡ [COMMON] ID Edges / Corners Cut Off", raw: "Valid ID corners or borders are cropped / out of frame", field: "id_photo", msg: "Some edges or corners of your valid ID are cut off. Please place your ID flat and take a photo showing all 4 corners." },
  { label: "⚡ [COMMON] Primary ID Number Mismatch", raw: "ID number entered does not match number printed on ID card", field: "id_number", msg: "The ID number entered in the form does not match the number printed on your valid ID. Please check and correct your ID number." },
  { label: "⚡ [COMMON] Back of ID Missing / Unclear", raw: "Back of valid ID is missing, damaged, or barcode unreadable", field: "id_photo", msg: "The back of your valid ID is required or was not readable. Please upload a clear photo of the back of your ID." },
  { label: "🔍 [RARE] Address Incomplete / Missing Landmark", raw: "Installation address missing specific building or landmark", field: "address", msg: "Your installation address requires a clearer street detail or nearest landmark to assist the dispatch team. Please update your address." },
  { label: "🔍 [RARE] Expired Government ID Card", raw: "Submitted government-issued ID card has expired", field: "id_photo", msg: "The submitted government ID has expired. Please upload an active, unexpired valid government-issued ID." },
  { label: "🔍 [RARE] Name Spelling Mismatch on ID", raw: "Applicant name spelling does not match name on valid ID", field: "id_photo", msg: "The spelling of your name does not match the name printed on your valid ID. Please review and update your name." }
];

function renderValidatorPresetOptions(filterText) {
  var term = String(filterText || "").toLowerCase().trim();
  var common = [];
  var rare = [];

  for (var i = 0; i < VALIDATOR_PRESETS.length; i++) {
    var p = VALIDATOR_PRESETS[i];
    if (i === 0) continue;
    if (term) {
      var match = (p.label + " " + p.raw + " " + p.msg + " " + p.field).toLowerCase().indexOf(term) !== -1;
      if (!match) continue;
    }
    var opt = "<option value='" + i + "'>" + escapeHtml(p.label) + "</option>";
    if (p.label.indexOf("[COMMON]") !== -1) {
      common.push(opt);
    } else {
      rare.push(opt);
    }
  }

  var html = "<option value=''>-- Select Remark Preset (" + (common.length + rare.length) + " available) --</option>";
  if (common.length) {
    html += "<optgroup label='⭐ Common Remarks (Frequent)'>" + common.join("") + "</optgroup>";
  }
  if (rare.length) {
    html += "<optgroup label='🔍 Rare Remarks (Occasional)'>" + rare.join("") + "</optgroup>";
  }
  if (!common.length && !rare.length) {
    html += "<option value='' disabled>No remarks found matching \"" + escapeHtml(term) + "\"</option>";
  }
  return html;
}

function filterValidatorPresets(term) {
  var sel = document.getElementById("det-preset-select");
  if (!sel) return;
  sel.innerHTML = renderValidatorPresetOptions(term);
  var validOptions = sel.querySelectorAll("option[value]:not([value=''])");
  if (validOptions.length === 1) {
    sel.value = validOptions[0].value;
    onValidatorPresetChange(sel.value);
  }
}

function onValidatorPresetChange(val) {
  var idx = parseInt(val, 10);
  if (isNaN(idx) || idx < 0 || idx >= VALIDATOR_PRESETS.length) return;
  var p = VALIDATOR_PRESETS[idx];
  if (!p || !p.raw) return;
  var rawEl = document.getElementById("det-validator-raw");
  var fieldEl = document.getElementById("det-correction-field");
  var remEl = document.getElementById("det-remarks");
  if (rawEl) rawEl.value = p.raw;
  if (fieldEl) fieldEl.value = p.field;
  if (remEl) remEl.value = p.msg;
}

window.addEventListener("DOMContentLoaded", async function () {
  currentAgent = await requireLogin(["agent", "manager", "admin"]);
  if (!currentAgent) return;

  document.getElementById("top-user-name").textContent = currentAgent.full_name;
  await refreshAgentData();
  initDashUI(currentAgent, allApps, openAppDetail);
});

async function refreshAgentData() {
  allApps = await dbListAllApplications();
  updateDashSearchApps(allApps);

  var unclaimed = 0, myClaimed = 0, fix = 0, encoded = 0;
  var planCounts = { "1000": 0, "1400": 0, "1900": 0 };

  for (var i = 0; i < allApps.length; i++) {
    var a = allApps[i];
    if (!a.assigned_agent && a.status === "Pending Review") unclaimed++;
    if (a.assigned_agent === currentAgent.email && (a.status === "Pending Review" || a.status === "Under Agent Review")) myClaimed++;
    if (a.status === "Needs Correction") fix++;
    if (a.status === "Approved" || a.status === "Submitted to Provider" || a.encoded) encoded++;

    if (String(a.plan_name).indexOf("1000") !== -1) planCounts["1000"]++;
    else if (String(a.plan_name).indexOf("1400") !== -1) planCounts["1400"]++;
    else if (String(a.plan_name).indexOf("1900") !== -1) planCounts["1900"]++;
  }

  // Update sidebar badges & overview stats
  document.getElementById("cnt-queue").textContent = unclaimed;
  document.getElementById("cnt-claimed").textContent = myClaimed;
  document.getElementById("cnt-correction").textContent = fix;
  document.getElementById("cnt-encoded").textContent = encoded;

  document.getElementById("st-unclaimed").textContent = unclaimed;
  document.getElementById("st-myclaimed").textContent = myClaimed;
  document.getElementById("st-fix").textContent = fix;
  document.getElementById("st-encoded").textContent = encoded;

  // Render Overview Charts & Calendar
  renderBars("chart-agent-bars", [
    { label: "Unclaimed", value: unclaimed, color: "#64748b" },
    { label: "My Claimed", value: myClaimed, color: "#2563eb" },
    { label: "Needs Fix", value: fix, color: "#d97706" },
    { label: "Encoded", value: encoded, color: "#15803d" }
  ]);
  renderColumns("chart-agent-cols", [
    { label: "Plan 1000", value: planCounts["1000"], color: "#c8102e" },
    { label: "Plan 1400", value: planCounts["1400"], color: "#0f172a" },
    { label: "Plan 1900", value: planCounts["1900"], color: "#2563eb" }
  ]);
  renderCalendar("agent-calendar", allApps);

  renderAgentCards();
  await renderAgentLinks();
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
      queue: ["Application Queue (Unclaimed)", "New customer applications waiting to be claimed by a verification agent."],
      claimed: ["My Claimed Applications", "Applications you have claimed and are actively verifying."],
      correction: ["Needs Correction", "Applications waiting for customer corrections or recently resubmitted."],
      encoded: ["Encoded & Approved Applications", "Verified applications encoded into the provider system."]
    };
    document.getElementById("apps-heading").textContent = titles[branch][0];
    document.getElementById("apps-subtitle").textContent = titles[branch][1];
    renderAgentCards();
  }
}

function getSimpleAiSummary(app) {
  if (!isAiEnabled()) {
    return '<span class="badge badge-yellow">AI is under maintenance</span>';
  }
  var ai = app.ai_result || {};
  var st = ai.overall_status || "Pending";
  var note = (ai.issues && ai.issues.length > 0) ? ai.issues.join(", ") : "ID readable and fields checked.";
  var cls = st === "Verified" ? "badge-green" : (st.indexOf("Needs") !== -1 ? "badge-yellow" : "badge-gray");
  return '<span class="badge ' + cls + '">AI: ' + escapeHtml(st) + '</span> <span class="muted">' + escapeHtml(note) + '</span>';
}

// Render Clean Card-Based Application List
function renderAgentCards() {
  var box = document.getElementById("agent-cards-box");
  if (!box) return;
  var q = (document.getElementById("q-filter") ? document.getElementById("q-filter").value : "").trim().toLowerCase();

  var filtered = [];
  for (var i = 0; i < allApps.length; i++) {
    var a = allApps[i];
    if (activeBranch === "queue" && (a.assigned_agent || a.status !== "Pending Review")) continue;
    if (activeBranch === "claimed" && !(a.assigned_agent === currentAgent.email && (a.status === "Pending Review" || a.status === "Under Agent Review"))) continue;
    if (activeBranch === "correction" && a.status !== "Needs Correction" && !a.has_correction) continue;
    if (activeBranch === "encoded" && a.status !== "Approved" && a.status !== "Submitted to Provider" && !a.encoded) continue;

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
      claimBtn = '<span class="badge badge-gray">Claimed: ' + escapeHtml(app.assigned_agent) + '</span>';
    }

    html +=
      '<div class="q-card">' +
        '<div class="q-head">' +
          '<div>' +
            '<div class="q-name">' + escapeHtml(app.full_name) + ' <span class="muted" style="font-weight:500; font-size:12px">(' + escapeHtml(app.reference_no) + ')</span></div>' +
            '<div class="q-sub" style="margin-top:6px; display:flex; gap:8px; align-items:center; flex-wrap:wrap">' +
              statusBadge(app.status) +
              (app.has_correction ? '<span class="badge badge-blue">Corrected Copy Available</span>' : '') +
              (app.encoded ? '<span class="badge badge-green">✓ Encoded</span>' : '') +
              '<button type="button" class="btn btn-outline btn-sm" style="padding:2px 8px; font-size:11px" onclick="toggleCardMore(\'more-' + escapeHtml(app.id) + '\')">▼ Quick Info</button>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex; gap:8px; align-items:center">' +
            '<button type="button" class="btn btn-outline btn-sm" onclick="openAppDetail(\'' + escapeHtml(app.id) + '\')">Details</button>' +
            claimBtn +
          '</div>' +
        '</div>' +
        '<div id="more-' + escapeHtml(app.id) + '" class="q-more hidden">' +
          '<div><b>Plan:</b> ' + escapeHtml(app.plan_name) + ' • <b>Location:</b> ' + escapeHtml((app.barangay || "") + ", " + (app.city || "") + ", " + (app.province || "")) + '</div>' +
          '<div style="margin-top:4px"><b>AI Screening:</b> ' + getSimpleAiSummary(app) + '</div>' +
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
  await dbUpdateApplication(appId, {
    assigned_agent: currentAgent.email,
    status: "Under Agent Review"
  });
  var app = findAppById(appId);
  if (app) {
    await dbAddAiLog(app.id, app.reference_no, "Agent (" + currentAgent.full_name + ")", "Claimed application from queue and started verification.");
    await dbAddLog(currentAgent.email, "Claimed application " + app.reference_no);
  }
  await refreshAgentData();
  showTab("claimed");
}

function findAppById(id) {
  for (var i = 0; i < allApps.length; i++) {
    if (allApps[i].id === id) return allApps[i];
  }
  return null;
}

// Open Full Verification Modal (Original vs Corrected Copy + AI Log + Encoding Proof)
async function openAppDetail(appId) {
  activeDetailAppId = appId;
  activeCopyMode = "latest";
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

async function renderDetailModalContent() {
  var app = findAppById(activeDetailAppId);
  if (!app) return;

  document.getElementById("det-title").textContent = app.reference_no + " — " + app.full_name;
  var viewData = (activeCopyMode === "original" && app.original_submission) ? app.original_submission : app;

  // Load AI Screening Activity Log
  var aiLogs = await dbListAiLogs(app.id);
  var aiLogHtml = "";
  if (!isAiEnabled()) {
    aiLogHtml = '<div class="msg info show"><b>Local AI is currently offline.</b> Manual agent verification is active.</div>';
  } else {
    var ai = app.ai_result || {};
    aiLogHtml +=
      '<div class="chat-item ai">' +
        '<div class="who">🤖 AI Document Screening (' + escapeHtml(ai.overall_status || "Checked") + ')</div>' +
        '<div>Blur Score: <b>' + (ai.blur_score || "N/A") + '</b> • Name Match: <b>' + (ai.name_match ? "Yes" : "Check") + '</b> • ID No. Match: <b>' + (ai.id_number_match ? "Yes" : "Check") + '</b></div>' +
        '<div class="muted" style="font-size:12px; margin-top:4px">' + escapeHtml((ai.issues && ai.issues.length) ? ai.issues.join("; ") : "No readability issues flagged.") + '</div>' +
      '</div>';
    for (var i = 0; i < aiLogs.length; i++) {
      var item = aiLogs[i];
      aiLogHtml +=
        '<div class="chat-item">' +
          '<div class="who">' + escapeHtml(item.actor) + ' • <span class="muted" style="font-weight:400">' + formatDate(item.created_at) + '</span></div>' +
          '<div>' + escapeHtml(item.message) + '</div>' +
        '</div>';
    }
  }

  var copySwitcher = "";
  if (app.original_submission) {
    copySwitcher =
      '<div style="display:flex; gap:8px; margin-bottom:14px; padding:10px; background:var(--soft); border-radius:8px; align-items:center">' +
        '<b style="font-size:12px">Compare Versions:</b>' +
        '<button type="button" class="btn btn-sm ' + (activeCopyMode === "latest" ? "btn-red" : "btn-outline") + '" onclick="switchCopyMode(\'latest\')">Corrected / Latest Copy</button>' +
        '<button type="button" class="btn btn-sm ' + (activeCopyMode === "original" ? "btn-red" : "btn-outline") + '" onclick="switchCopyMode(\'original\')">Original Submission</button>' +
      '</div>';
  }

  var idPhotoUrl = viewData.id_image_url || app.id_image_url || app.id_front_path || "assets/images/logo.png";
  var idBackPhotoUrl = viewData.id_back_path || app.id_back_path || "";

  document.getElementById("det-body").innerHTML =
    copySwitcher +
    '<div class="grid-2" style="align-items:start">' +
      '<div>' +
        '<h3 style="margin-bottom:8px">Applicant &amp; Service Address (' + (activeCopyMode === "original" ? "Original Copy" : "Latest Copy") + ')</h3>' +
        '<div class="kv">' +
          '<div><span>Status</span><b>' + statusBadge(app.status) + '</b></div>' +
          '<div><span>Selected Plan</span><b>' + escapeHtml(app.plan_name) + '</b></div>' +
          '<div><span>Full Name</span><b>' + escapeHtml(viewData.full_name || app.full_name) + '</b></div>' +
          '<div><span>Birth Date</span><b>' + escapeHtml(app.birth_date || "—") + '</b></div>' +
          '<div><span>Email</span><b>' + escapeHtml((activeCopyMode === "latest" && app.corrected_copy && app.corrected_copy.contact_email) ? app.corrected_copy.contact_email : (viewData.email || app.email)) + '</b></div>' +
          '<div><span>Primary Mobile</span><b>' + escapeHtml(viewData.phone || app.phone) + '</b></div>' +
          '<div><span>Primary ID Type</span><b>' + escapeHtml(viewData.id_type || app.id_type) + '</b></div>' +
          '<div><span>Primary ID Number</span><b>' + escapeHtml(viewData.id_number || app.id_number) + '</b></div>' +
          '<div><span>Building / Street</span><b>' + escapeHtml((app.building_name || "") + " " + (viewData.street || app.street || "")) + '</b></div>' +
          '<div><span>Subdivision / Brgy</span><b>' + escapeHtml((app.subdivision || "") + ", " + (app.barangay || "")) + '</b></div>' +
          '<div><span>City / Province</span><b>' + escapeHtml((app.city || "") + ", " + (app.province || "")) + '</b></div>' +
          '<div><span>Nearest Landmark</span><b>' + escapeHtml(app.landmark || "—") + '</b></div>' +
          '<div><span>Pinned Coordinates</span><b>' + escapeHtml(app.latitude + ", " + app.longitude) + '</b></div>' +
        '</div>' +
      '</div>' +

      '<div>' +
        '<h3 style="margin-bottom:8px">Submitted Valid ID Photos (Front &amp; Back)</h3>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px">' +
          '<div style="border:1px solid var(--line); border-radius:8px; padding:6px; background:var(--soft); text-align:center">' +
            '<div style="font-size:11px; font-weight:700; margin-bottom:4px">FRONT ID</div>' +
            '<img src="' + escapeHtml(idPhotoUrl) + '" alt="Front ID" style="max-height:160px; max-width:100%; border-radius:4px; object-fit:contain" />' +
          '</div>' +
          '<div style="border:1px solid var(--line); border-radius:8px; padding:6px; background:var(--soft); text-align:center">' +
            '<div style="font-size:11px; font-weight:700; margin-bottom:4px">BACK ID</div>' +
            (idBackPhotoUrl ? '<img src="' + escapeHtml(idBackPhotoUrl) + '" alt="Back ID" style="max-height:160px; max-width:100%; border-radius:4px; object-fit:contain" />' : '<span class="muted small" style="display:block; padding:40px 0">No Back ID uploaded</span>') +
          '</div>' +
        '</div>' +

        '<h3 style="margin-bottom:8px">AI Screening &amp; Activity Log</h3>' +
        '<div class="chat-log" style="max-height:200px; overflow-y:auto">' + aiLogHtml + '</div>' +
      '</div>' +
    '</div>' +

    // Agent Decision Controls with Quick Remark Dropdown & AI Running Spinner
    '<div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--line)">' +
      '<h3 style="margin-bottom:10px">Agent Encoding &amp; Decision</h3>' +
      '<div class="grid-2">' +
        '<div class="field">' +
          '<label>Upload Provider Encoding Screenshot Proof (Required to mark Encoded)</label>' +
          '<input type="file" accept="image/*" onchange="onEncodingProofPick(this)" />' +
          (app.encoding_proof_url ? '<div style="margin-top:6px"><span class="badge badge-green">✓ Proof Uploaded</span></div>' : '') +
        '</div>' +
        '<div class="field">' +
          '<label>Rejection Category (if rejecting)</label>' +
          '<select id="det-reject-type">' +
            '<option value="">— Select only if rejecting —</option>' +
            '<option value="Minor Issue (Unreadable / Mismatched Info)">Minor Issue (Unreadable / Mismatched Info)</option>' +
            '<option value="Major Issue (Outside Service Coverage Area)">Major Issue (Outside Service Coverage Area)</option>' +
            '<option value="Major Issue (Invalid / Fraudulent Document)">Major Issue (Invalid / Fraudulent Document)</option>' +
          '</select>' +
        '</div>' +
      '</div>' +

      // Quick Dropdown + Search + AI Polite Message
      '<div class="card" style="background:var(--soft); margin-bottom:12px; padding:12px">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px">' +
          '<div>' +
            '<b>⚡ Quick Select Validator Remark &amp; Auto-Polite Message</b>' +
            '<div class="muted" style="font-size:12px">Pick a common or rare remark from the dropdown to auto-fill the target field and customer instruction without typing.</div>' +
          '</div>' +
          '<div style="display:flex; gap:8px; align-items:center;">' +
            '<span id="ai-running-spinner" class="badge badge-blue" style="display:none;">🤖 AI is running, please wait...</span>' +
            '<button type="button" id="btn-ai-polite" class="btn btn-outline btn-sm" onclick="convertValidatorToPoliteRemark()">✨ AI Generate Polite Message</button>' +
          '</div>' +
        '</div>' +

        '<div class="field" style="margin-bottom:10px">' +
          '<label>⚡ Common &amp; Rare Validator Presets (Quick Select &amp; Search)</label>' +
          '<input id="det-preset-search" type="text" placeholder="🔍 Type to filter remarks (e.g. email, phone, blur, cut-off, expired)..." oninput="filterValidatorPresets(this.value)" style="margin-bottom:6px; font-size:12px; padding:7px 10px; border-radius:6px; border:1px solid var(--line); width:100%;" />' +
          '<select id="det-preset-select" onchange="onValidatorPresetChange(this.value)">' +
            renderValidatorPresetOptions() +
          '</select>' +
        '</div>' +

        '<div class="grid-2">' +
          '<div class="field" style="margin-bottom:0">' +
            '<label>Raw Validator / RADIUS Remark</label>' +
            '<input id="det-validator-raw" type="text" value="' + escapeHtml(app.validator_raw_remark || "") + '" placeholder="e.g. Duplicate email in RADIUS / Mobile number already registered / Blurry ID..." />' +
          '</div>' +
          '<div class="field" style="margin-bottom:0">' +
            '<label>Specific Field for Customer to Update</label>' +
            '<select id="det-correction-field">' +
              '<option value="auto">Auto-Detect from Validator Remark</option>' +
              '<option value="email" ' + ((app.correction_fields || []).join(",") === "email" ? "selected" : "") + '>Email Address Only (Duplicate Email in RADIUS)</option>' +
              '<option value="phone" ' + ((app.correction_fields || []).join(",") === "phone" ? "selected" : "") + '>Mobile Number Only (Duplicate Mobile in RADIUS)</option>' +
              '<option value="email_or_phone" ' + ((app.correction_fields || []).join(",") === "email,phone" ? "selected" : "") + '>Both Email &amp; Mobile Number (Duplicate Record)</option>' +
              '<option value="id_photo" ' + ((app.correction_fields || []).join(",") === "id_photo" ? "selected" : "") + '>Valid ID Photo (Blurry / Glare / Unreadable)</option>' +
              '<option value="id_number" ' + ((app.correction_fields || []).join(",") === "id_number" ? "selected" : "") + '>Primary ID Number (Mismatch)</option>' +
              '<option value="address" ' + ((app.correction_fields || []).join(",") === "address" ? "selected" : "") + '>Installation Address / Landmark</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="field">' +
        '<label>Polite Message Sent to Customer (Auto-generated or editable below)</label>' +
        '<textarea id="det-remarks" rows="2" placeholder="Select a preset above or click \'✨ AI Generate Polite Message\'...">' + escapeHtml(app.agent_remarks || "") + '</textarea>' +
      '</div>' +
      '<label style="display:flex; gap:8px; align-items:center; font-size:13px; font-weight:700; margin-bottom:14px">' +
        '<input id="det-encoded-chk" type="checkbox" style="width:auto" ' + (app.encoded ? "checked" : "") + ' />' +
        'Mark Application as Encoded to Red Fiber Provider (Wait 3–5 business days message sent to customer)' +
      '</label>' +
      '<div style="display:flex; gap:10px; flex-wrap:wrap">' +
        '<button type="button" class="btn btn-green" onclick="saveAgentDecision(\'Approved\')">✓ Approve &amp; Encode</button>' +
        '<button type="button" class="btn btn-outline" style="border-color:#d97706; color:#b45309" onclick="saveAgentDecision(\'Needs Correction\')">⚠ Request Correction</button>' +
        '<button type="button" class="btn btn-red" onclick="saveAgentDecision(\'Rejected\')">✕ Reject Application</button>' +
      '</div>' +
    '</div>';
}

async function convertValidatorToPoliteRemark() {
  var rawEl = document.getElementById("det-validator-raw");
  var remEl = document.getElementById("det-remarks");
  var fieldEl = document.getElementById("det-correction-field");
  var btn = document.getElementById("btn-ai-polite");
  var spin = document.getElementById("ai-running-spinner");

  var rawText = (rawEl && rawEl.value.trim()) || (remEl && remEl.value.trim()) || "";
  var chosenField = fieldEl ? fieldEl.value : "auto";

  if (!rawText && chosenField === "auto") {
    showAlert("Validator Remark Needed", "Please select a preset above or paste a raw validator remark first.");
    return null;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "AI Running...";
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
    showAlert("AI Service Offline", "Local Ollama AI is currently offline on this device. Please select a preset from the Quick Select dropdown above or type the customer instruction manually.");
    return null;
  } finally {
    if (spin) spin.style.display = "none";
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✨ AI Generate Polite Message";
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
  var remarks = document.getElementById("det-remarks").value.trim();
  var rejectType = document.getElementById("det-reject-type").value;
  var isEncoded = document.getElementById("det-encoded-chk").checked || newStatus === "Approved";
  var targetFields = lastDetectedFields || [];

  if (chosenField === "email") targetFields = ["email"];
  else if (chosenField === "phone") targetFields = ["phone"];
  else if (chosenField === "email_or_phone") targetFields = ["email", "phone"];
  else if (chosenField !== "auto") targetFields = [chosenField];

  // If requesting correction, try local AI if remarks are empty
  if (newStatus === "Needs Correction") {
    if (!remarks && (rawValidator || chosenField !== "auto")) {
      var aiGen = await convertValidatorToPoliteRemark();
      if (aiGen) {
        remarks = aiGen.polite_message;
        targetFields = aiGen.target_fields || targetFields;
      }
    }
    if (!remarks) {
      showAlert("Customer Instruction Required", "Please type the instruction for the customer or choose a Quick Preset above.");
      return;
    }
  }

  if (newStatus === "Rejected") {
    if (!rejectType && !remarks && !rawValidator) {
      showAlert("Reason Required", "Please select a Rejection Category or write the reason for rejection.");
      return;
    }
    if (!remarks && rawValidator) {
      remarks = rawValidator;
    }
    remarks = (rejectType ? "[" + rejectType + "] " : "") + remarks;
  }
  if (newStatus === "Approved" && !remarks) {
    remarks = "Application verified and encoded. Please wait 3–5 business days for installation dispatch.";
  }

  var proofUrl = pendingProofDataUrl || app.encoding_proof_url || "";
  var updatedScreening = Object.assign({}, app.screening || {}, {
    correction_fields: newStatus === "Needs Correction" ? targetFields : [],
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
    encoding_proof_url: proofUrl
  });

  lastDetectedFields = null;

  await dbAddAiLog(
    app.id,
    app.reference_no,
    "Agent (" + currentAgent.full_name + ")",
    "Set status to " + newStatus + (targetFields.length ? " [Target fields: " + targetFields.join(", ") + "]" : "") + (isEncoded ? " (Encoded)" : "") + ": " + remarks
  );

  await dbAddNotification(
    app.email,
    "customer",
    "Application " + newStatus + " (" + app.reference_no + ")",
    remarks
  );
  await apiSendStatusEmail(app.email, app.full_name, app.reference_no, newStatus, remarks);
  await dbAddLog(currentAgent.email, "Updated " + app.reference_no + " to " + newStatus);

  closeDetailModal();
  await refreshAgentData();
  showAlert("Decision Saved", "Application " + app.reference_no + " is now marked as " + newStatus + ".");
}

function downloadApplicantId() {
  var app = findAppById(activeDetailAppId);
  if (!app) return;
  var a = document.createElement("a");
  a.href = app.id_image_url || app.id_front_path || "assets/images/logo.png";
  a.download = (app.reference_no || "applicant") + "-ID.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function printApplicantCopy() {
  window.print();
}

// Agent Referral / Application Links
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
