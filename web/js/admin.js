var currentAdmin = null;
var adminApps = [];
var adminUsers = [];
var activeAdminTab = "overview";

window.addEventListener("DOMContentLoaded", async function () {
  currentAdmin = await requireLogin(["admin"]);
  if (!currentAdmin) return;

  document.getElementById("top-user-name").textContent = currentAdmin.full_name;
  await refreshAdminData();
  initDashUI(currentAdmin, adminApps, function () { showTab("reports"); });

  setTimeout(function () {
    if (typeof POPUP_GUIDE_MANAGER !== "undefined") {
      POPUP_GUIDE_MANAGER.autoShowForPortal("admin_technical_guide");
    }
  }, 220);
});

async function refreshAdminData() {
  adminApps = await dbListAllApplications();
  adminUsers = await dbListUsers();
  updateDashSearchApps(adminApps);

  var aiOn = isAiEnabled();
  var maintOn = isMaintenanceOn();

  document.getElementById("st-users").textContent = adminUsers.length;
  document.getElementById("st-apps").textContent = adminApps.length;
  document.getElementById("st-ai").textContent = aiOn ? "ON" : "OFF";
  document.getElementById("st-maint").textContent = maintOn ? "ON" : "OFF";

  var rCounts = { customer: 0, agent: 0, manager: 0, admin: 0 };
  for (var i = 0; i < adminUsers.length; i++) {
    var r = adminUsers[i].role || "customer";
    rCounts[r] = (rCounts[r] || 0) + 1;
  }

  var pending = 0, fix = 0, approved = 0, rejected = 0;
  for (var j = 0; j < adminApps.length; j++) {
    var st = adminApps[j].status;
    if (st === "Pending Review" || st === "Under Agent Review" || st === "Encoding") pending++;
    else if (st === "Needs Correction") fix++;
    else if (st === "Approved" || st === "Submitted to Provider") approved++;
    else if (st === "Rejected") rejected++;
  }

  renderBars("chart-admin-bars", [
    { label: "Customers", value: rCounts.customer, color: "#64748b" },
    { label: "Agents", value: rCounts.agent, color: "#2563eb" },
    { label: "Managers", value: rCounts.manager, color: "#d97706" },
    { label: "Admins", value: rCounts.admin, color: "#c8102e" }
  ]);
  renderColumns("chart-admin-cols", [
    { label: "Pending", value: pending, color: "#2563eb" },
    { label: "Needs Fix", value: fix, color: "#d97706" },
    { label: "Approved", value: approved, color: "#15803d" },
    { label: "Rejected", value: rejected, color: "#dc2626" }
  ]);

  renderCalendar("admin-overview-calendar", adminApps);
  renderCalendar("admin-full-calendar", adminApps);

  renderMaintState();
  await renderAdminPopupGuides();
  await renderAiState();
  await checkApiHealth();
  renderAdminUsers();
  await renderAdminLogs();
}

function showTab(tab) {
  activeAdminTab = tab;
  var tabs = ["overview", "maintenance", "ai", "apis", "accounts", "logs", "calendar", "reports"];
  for (var i = 0; i < tabs.length; i++) {
    var btn = document.getElementById("nav-" + tabs[i]);
    if (btn) btn.classList.toggle("active", tabs[i] === tab);
    var sec = document.getElementById("tab-" + tabs[i]);
    if (sec) sec.classList.toggle("hidden", tabs[i] !== tab);
  }
}

function renderMaintState() {
  var on = isMaintenanceOn();
  var lbl = document.getElementById("maint-status-label");
  var btn = document.getElementById("btn-toggle-maint");
  if (lbl) lbl.textContent = on ? "Currently ON (Public application submissions are paused)" : "Currently OFF (Public website is accepting applications)";
  if (btn) {
    btn.textContent = on ? "Disable Maintenance Mode" : "Enable Maintenance Mode";
    btn.className = "btn " + (on ? "btn-green" : "btn-red");
  }
}

function toggleMaintMode() {
  var next = !isMaintenanceOn();
  openConfirmPopup(
    next ? "Confirm Enabling Public Maintenance Mode" : "Confirm Returning Public Website to Live",
    next
      ? "Mutating <code>public.system_settings.maintenance_mode = true</code> will temporarily block external customer access to <code>index.html</code>, <code>apply.html</code>, and <code>activate.html</code> while keeping staff/admin portals operational."
      : "Mutating <code>public.system_settings.maintenance_mode = false</code> will immediately restore public visitor access to the live website and application form.",
    next ? "Enable Maintenance Mode" : "Disable Maintenance Mode",
    async function () {
      setMaintenanceOn(next);
      await dbAddLog(currentAdmin.email, "Set Maintenance Mode to " + (next ? "ON" : "OFF"));
      await refreshAdminData();
    },
    next
  );
}

async function renderAdminPopupGuides() {
  var body = document.getElementById("admin-popup-guides-body");
  if (!body || typeof dbListPopupGuides !== "function") return;
  var guides = await dbListPopupGuides();
  var html = "";
  for (var i = 0; i < guides.length; i++) {
    var g = guides[i];
    var isTech = g.audience_tone === "technical";
    html +=
      '<tr>' +
        '<td><b>' + escapeHtml(g.id) + '</b><div class="tiny muted">Portal: ' + escapeHtml(g.portal) + '</div></td>' +
        '<td><span class="badge ' + (isTech ? "badge-gray" : "badge-green") + '">' + (isTech ? "Technical (Admin)" : "Polite & Simple") + '</span></td>' +
        '<td>' + escapeHtml(g.title) + '</td>' +
        '<td>' + (g.auto_show !== false ? '<span class="badge badge-green">Enabled</span>' : '<span class="badge badge-gray">Manual Only</span>') + '</td>' +
        '<td>' +
          '<div style="display:flex; gap:6px; flex-wrap:wrap">' +
            '<button type="button" class="btn btn-outline btn-sm" onclick="showPortalGuide(\'' + escapeHtml(g.id) + '\')">Preview</button>' +
            '<button type="button" class="btn btn-outline btn-sm" onclick="adminToggleGuideAutoShow(\'' + escapeHtml(g.id) + '\', ' + (g.auto_show === false) + ')">' +
              (g.auto_show !== false ? "Disable Auto-Show" : "Enable Auto-Show") +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
  }
  body.innerHTML = html || '<tr><td colspan="5" class="muted">No pop-up guides configured.</td></tr>';
}

async function adminToggleGuideAutoShow(guideId, nextAutoShow) {
  var guide = POPUP_GUIDE_MANAGER.getGuide(guideId);
  if (!guide) return;
  guide.auto_show = Boolean(nextAutoShow);
  await dbSavePopupGuide(guide);
  await dbAddLog(currentAdmin.email, "Set popup_guides[" + guideId + "].auto_show = " + guide.auto_show);
  await renderAdminPopupGuides();
}

var lastHealthData = null;

async function renderAiState() {
  var on = isAiEnabled();
  var health = await apiCheckHealth();
  lastHealthData = health;
  var pyOnline = Boolean(health && health.api);
  var ollamaOnline = Boolean(health && health.ollama);
  var activeJobs = Number((health && health.active_screenings) || 0);

  var stAiEl = document.getElementById("st-ai");
  if (stAiEl) {
    stAiEl.textContent = (!on) ? "PAUSED" : (pyOnline ? "ONLINE" : "OFFLINE");
  }

  var lbl = document.getElementById("ai-status-label");
  var btn = document.getElementById("btn-toggle-ai");
  if (lbl) {
    if (!on) {
      lbl.textContent = "Currently DISABLED by Admin (Agent & Manager workspaces switch cleanly to manual document review)";
    } else if (!pyOnline) {
      lbl.textContent = "Local Python FastAPI Screening Server is OFFLINE on this device - manual agent review is active.";
    } else {
      lbl.textContent = "2-Layer Background AI Screening Engine ONLINE (Active parallel jobs: " + activeJobs + " - OpenCV + PaddleOCR" + (ollamaOnline ? " + Ollama qwen2.5:1.5b" : " + Plain-Language Fallback") + ")";
    }
  }
  if (btn) {
    btn.textContent = on ? "Disable AI Screening" : "Enable AI Screening";
    btn.className = "btn " + (on ? "btn-red" : "btn-green");
  }

  var aiList = await dbListAiLogs();
  var box = document.getElementById("admin-ai-log-list");
  if (!box) return;
  if (aiList.length === 0) {
    box.innerHTML = '<div class="muted" style="font-size:13px">No AI screening logs recorded yet.</div>';
    return;
  }
  var html = "";
  for (var i = 0; i < Math.min(aiList.length, 20); i++) {
    var item = aiList[i];
    html +=
      '<div class="chat-item ai">' +
        '<div class="who">' + escapeHtml(item.reference_no || "") + ' - ' + escapeHtml(item.actor) + ' <span class="muted" style="font-weight:400">(' + formatDate(item.created_at) + ')</span></div>' +
        '<div>' + escapeHtml(item.message) + '</div>' +
      '</div>';
  }
  box.innerHTML = html;
}

function toggleAiMode() {
  var next = !isAiEnabled();
  openConfirmPopup(
    next ? "Enable 2-Layer Background Screening Engine?" : "Disable 2-Layer Background Screening Engine?",
    next
      ? "Enabling <code>public.system_settings.ai_enabled = true</code> resumes asynchronous OpenCV + PaddleOCR + Ollama background screening via <code>POST /screen-async</code>."
      : "Disabling <code>public.system_settings.ai_enabled = false</code> pauses automated screening. Customer submissions will continue without interruption using original uploaded ID copies, and all Agents &amp; Managers will receive a manual-review notification.",
    next ? "Enable AI Screening" : "Disable AI Screening",
    async function () {
      setAiEnabled(next);
      await dbAddLog(currentAdmin.email, "Set AI Screening Engine to " + (next ? "ENABLED" : "DISABLED"));
      if (!next) {
        await dbAddNotification(null, "agent", "Auto-Screening Paused", "Auto-screening is currently paused. Customer applications continue normally using original uploaded ID copies for manual review.");
        await dbAddNotification(null, "manager", "Auto-Screening Paused", "Auto-screening is currently paused. Customer applications continue normally using original uploaded ID copies for manual review.");
      }
      await refreshAdminData();
    },
    !next
  );
}

async function checkApiHealth() {
  var box = document.getElementById("api-health-list");
  if (!box) return;

  var apiUrl = CONFIG.API_URL || "http://127.0.0.1:8001";
  var data = await apiCheckHealth();
  var pyOk = Boolean(data && data.api);
  var ollamaOk = Boolean(data && data.ollama);
  var opencvOk = Boolean(pyOk && data && data.opencv);
  var ocrOk = Boolean(pyOk && data && data.paddleocr);
  var smtpOk = Boolean(pyOk && data && (data.smtp || data.resend));
  var supaOk = !IS_DEMO_MODE;
  var activeJobs = Number((data && data.active_screenings) || 0);

  var smtpBadgeEl = document.getElementById("smtp-status-badge");
  if (smtpBadgeEl) {
    smtpBadgeEl.className = "badge " + (smtpOk ? "badge-green" : "badge-red");
    smtpBadgeEl.textContent = smtpOk ? "Gmail SMTP Connected" : (pyOk ? "SMTP Password Missing" : "Server Offline");
  }

  var items = [
    {
      name: "2-Layer Parallel Screening Coordinator (FastAPI /screen-async)",
      status: pyOk ? ("Online (" + activeJobs + " active)") : "Offline",
      badge: pyOk ? "badge-green" : "badge-red",
      detail: pyOk
        ? "Fetches Valid IDs from Supabase Storage bucket & runs concurrent Layer 1 + Layer 2 background screening"
        : "Offline on this device - start FastAPI server at " + apiUrl
    },
    {
      name: "Ollama Local AI Engine (qwen2.5:1.5b)",
      status: ollamaOk ? "Online (Local)" : "Fallback Active",
      badge: ollamaOk ? "badge-green" : "badge-yellow",
      detail: ollamaOk
        ? "Running locally at http://localhost:11434 (generates plain-language remarks & guidance)"
        : "Ollama not running - built-in deterministic plain-English guidance & polite messages active"
    },
    {
      name: "OpenCV Auto-Crop & Image Quality API (Layer 1 & Layer 2)",
      status: opencvOk ? "Online" : "Offline",
      badge: opencvOk ? "badge-green" : "badge-red",
      detail: opencvOk
        ? "4-corner perspective crop, rotation alignment, CLAHE enhancement, blur & glare scoring"
        : "Offline - Requires Python FastAPI & opencv-python-headless"
    },
    {
      name: "PaddleOCR ID Text Extraction & Mismatch Engine",
      status: ocrOk ? "Online" : "Offline",
      badge: ocrOk ? "badge-green" : "badge-red",
      detail: ocrOk
        ? "Extracts ID text & auto-checks Name, Birth Date, and ID Number mismatches"
        : "Offline - Requires Python FastAPI & PaddleOCR"
    },
    {
      name: "Gmail SMTP Email Engine (via Local FastAPI)",
      status: smtpOk ? "Online" : (pyOk ? "Needs App Password" : "Offline"),
      badge: smtpOk ? "badge-green" : "badge-red",
      detail: smtpOk
        ? "Ready at " + apiUrl + "/notify (smtp.gmail.com)"
        : (pyOk
            ? "Set SMTP_USER and 16-char Google App Password (SMTP_PASSWORD) in api/.env"
            : "Offline on this device (In-app Supabase notifications remain active)")
    },
    {
      name: "Supabase Cloud (PostgreSQL + Auth + Storage Buckets)",
      status: supaOk ? "Live Cloud" : "Local Demo Storage",
      badge: supaOk ? "badge-green" : "badge-blue",
      detail: supaOk ? (CONFIG.SUPABASE_URL + " (documents + website-assets buckets)") : "Running in local browser storage"
    }
  ];

  var html = "";
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    html +=
      '<div class="card" style="background:var(--soft)">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">' +
          '<b>' + escapeHtml(it.name) + '</b>' +
          '<span class="badge ' + it.badge + '">' + escapeHtml(it.status) + '</span>' +
        '</div>' +
        '<div class="muted" style="font-size:12px">' + escapeHtml(it.detail) + '</div>' +
      '</div>';
  }
  box.innerHTML = html;
}

function renderAdminUsers() {
  var body = document.getElementById("admin-users-body");
  if (!body) return;
  var html = "";
  for (var i = 0; i < adminUsers.length; i++) {
    var u = adminUsers[i];
    html +=
      '<tr>' +
        '<td><b>' + escapeHtml(u.full_name) + '</b></td>' +
        '<td>' + escapeHtml(u.email) + '</td>' +
        '<td>' +
          '<select onchange="adminChangeRole(\'' + escapeHtml(u.id) + '\', this.value)" style="padding:4px 8px; font-size:12px; width:auto">' +
            '<option value="customer" ' + (u.role === "customer" ? "selected" : "") + '>Customer</option>' +
            '<option value="agent" ' + (u.role === "agent" ? "selected" : "") + '>Agent</option>' +
            '<option value="manager" ' + (u.role === "manager" ? "selected" : "") + '>Manager</option>' +
            '<option value="admin" ' + (u.role === "admin" ? "selected" : "") + '>Admin</option>' +
          '</select>' +
        '</td>' +
        '<td>' + (u.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Disabled</span>') + '</td>' +
        '<td>' +
          '<button type="button" class="btn btn-outline btn-sm" onclick="adminToggleActive(\'' + escapeHtml(u.id) + '\', ' + (!u.active) + ')">' +
            (u.active ? "Disable" : "Enable") +
          '</button>' +
        '</td>' +
      '</tr>';
  }
  body.innerHTML = html;
}

async function adminCreateUser() {
  hideMsg("acc-msg");
  var name = document.getElementById("new-acc-name").value.trim();
  var email = document.getElementById("new-acc-email").value.trim().toLowerCase();
  var pw = (document.getElementById("new-acc-pw").value || "").trim();
  if (!pw || pw.length < 6) { showMsg("acc-msg", "error", "Please provide a password of at least 6 characters."); return; }
  var role = document.getElementById("new-acc-role").value;

  if (!name || !email) {
    showMsg("acc-msg", "error", "Please enter both Full Name and Email Address.");
    return;
  }
  try {
    await dbCreateUserAccount(name, email, pw, role);
    await dbAddLog(currentAdmin.email, "Created " + role + " account for " + email);
    document.getElementById("new-acc-name").value = "";
    document.getElementById("new-acc-email").value = "";
    showMsg("acc-msg", "ok", "Account created for " + email + " (" + role + ").");
    await refreshAdminData();
  } catch (err) {
    showMsg("acc-msg", "error", err.message);
  }
}

async function adminChangeRole(userId, newRole) {
  await dbUpdateUser(userId, { role: newRole });
  await dbAddLog(currentAdmin.email, "Changed role of user " + userId + " to " + newRole);
  await refreshAdminData();
}

async function adminToggleActive(userId, activeState) {
  await dbUpdateUser(userId, { active: activeState });
  await dbAddLog(currentAdmin.email, (activeState ? "Enabled" : "Disabled") + " user " + userId);
  await refreshAdminData();
}

async function renderAdminLogs() {
  var logs = await dbListLogs();
  var logBody = document.getElementById("admin-logs-body");
  if (logBody) {
    var h1 = "";
    for (var i = 0; i < Math.min(logs.length, 30); i++) {
      h1 += '<tr><td>' + formatDate(logs[i].created_at) + '</td><td><b>' + escapeHtml(logs[i].actor_email) + '</b></td><td>' + escapeHtml(logs[i].action) + '</td></tr>';
    }
    logBody.innerHTML = h1 || '<tr><td colspan="3" class="muted">No activity logs yet.</td></tr>';
  }

  var hist = await dbListLoginHistory();
  var histBody = document.getElementById("admin-login-history-body");
  if (histBody) {
    var h2 = "";
    for (var j = 0; j < Math.min(hist.length, 30); j++) {
      var ev = hist[j];
      h2 += '<tr><td>' + formatDate(ev.created_at) + '</td><td><b>' + escapeHtml(ev.email) + '</b></td><td>' + escapeHtml(ev.role) + '</td><td><span class="badge ' + (ev.action === "login" ? "badge-green" : "badge-gray") + '">' + escapeHtml(ev.action) + '</span></td></tr>';
    }
    histBody.innerHTML = h2 || '<tr><td colspan="4" class="muted">No login events recorded yet.</td></tr>';
  }
}

function exportApplicationsCsv() {
  var headers = ["Reference No", "Full Name", "Email", "Mobile", "Plan", "ID Type", "ID Number", "City", "Province", "Status", "Assigned Agent", "Created At"];
  var rows = [headers.join(",")];
  for (var i = 0; i < adminApps.length; i++) {
    var a = adminApps[i];
    var cols = [
      a.reference_no, a.full_name, a.email, a.phone, a.plan_name,
      a.id_type, a.id_number, a.city, a.province, a.status,
      a.assigned_agent || "Unassigned", a.created_at
    ];
    var escaped = cols.map(function (v) {
      return '"' + String(v || "").replace(/"/g, '""') + '"';
    });
    rows.push(escaped.join(","));
  }
  var blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = "PIGEM-Applications-Report.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function resetDemoDatabase() {
  localStorage.removeItem("pigem_apps");
  localStorage.removeItem("pigem_users");
  localStorage.removeItem("pigem_content");
  localStorage.removeItem("pigem_logs");
  localStorage.removeItem("pigem_ai_logs");
  showAlert("Demo Data Reset", "All demo records have been reset to factory defaults.", function () {
    window.location.reload();
  });
}

async function adminSendTestEmail() {
  var btn = document.getElementById("btn-test-email");
  var to = document.getElementById("test-email-to").value.trim();
  var type = document.getElementById("test-email-type").value;

  if (!to) {
    showMsg("test-email-msg", "error", "Please enter a recipient email address.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Sending via Gmail SMTP...";
  showMsg("test-email-msg", "info", "Connecting to Gmail SMTP (smtp.gmail.com)...");

  try {
    var res;
    if (type === "otp") {
      var sampleOtp = String(Math.floor(100000 + Math.random() * 900000));
      res = await apiSendOtpEmail(to, sampleOtp, "Admin Security Test", "Admin");
    } else if (type === "application_confirmation") {
      res = await apiSendApplicationConfirmationEmail(
        to,
        "Juan Dela Cruz",
        "PF-20261021-0001",
        { name: "Plan 1400", speed: "300", price: 1400 },
        "Blk 42 Lot 19 Tokya St., Summerwind Village M., Brgy. Burol Main, Dasmariñas City, Cavite",
        { status: "pending", code: "ACT-789012" }
      );
    } else if (type === "correction_notice") {
      res = await apiSendCorrectionEmail(to, "Juan Dela Cruz", "PF-20261021-0001", "The name entered on your application form does not match the name printed on your Valid ID.");
    } else if (type === "status_update") {
      res = await apiSendStatusEmail(to, "Juan Dela Cruz", "PF-20261021-0001", "Approved", "Your application has been approved by the provider.");
    } else if (type === "promotional") {
      res = await apiSendPromotionalEmail(
        to,
        "Juan Dela Cruz",
        "Exclusive Fiber Speed Boost for Cavite Residents",
        "Upgrade your plan today and experience seamless fiber internet with zero lock-in period fees.",
        [
          { name: "Red Fiber 100", speed: "100 Mbps", price: "₱1,699" },
          { name: "Red Fiber 200", speed: "200 Mbps", price: "₱2,199" }
        ]
      );
    }

    if (res && res.sent) {
      showMsg("test-email-msg", "ok", "Email delivered via Gmail SMTP to " + to + "! Check inbox (and Spam folder).");
    } else if (res && res.offline) {
      showMsg("test-email-msg", "error", "Local FastAPI server is offline (http://127.0.0.1:8001). Please start the server to send live emails.");
    } else {
      showMsg("test-email-msg", "error", "Delivery failed: " + ((res && res.reason) || "Unknown error"));
    }
  } catch (err) {
    showMsg("test-email-msg", "error", "Error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Send Live Email via Gmail SMTP";
  }
}
