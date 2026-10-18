// ============================================================
// TECHNICAL MANAGEMENT SYSTEM (ADMIN) LOGIC
// ============================================================

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

  // Count roles
  var rCounts = { customer: 0, agent: 0, manager: 0, admin: 0 };
  for (var i = 0; i < adminUsers.length; i++) {
    var r = adminUsers[i].role || "customer";
    rCounts[r] = (rCounts[r] || 0) + 1;
  }

  // Count app statuses
  var pending = 0, fix = 0, approved = 0, rejected = 0;
  for (var j = 0; j < adminApps.length; j++) {
    var st = adminApps[j].status;
    if (st === "Pending Review" || st === "Under Agent Review") pending++;
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

// 1. Maintenance Mode Toggle
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

async function toggleMaintMode() {
  var next = !isMaintenanceOn();
  setMaintenanceOn(next);
  await dbAddLog(currentAdmin.email, "Set Maintenance Mode to " + (next ? "ON" : "OFF"));
  await refreshAdminData();
}

// 2. AI Screening Control
async function renderAiState() {
  var on = isAiEnabled();
  var lbl = document.getElementById("ai-status-label");
  var btn = document.getElementById("btn-toggle-ai");
  if (lbl) {
    lbl.textContent = on
      ? "Currently ENABLED (OpenCV + PaddleOCR + Ollama screening active)"
      : "Currently DISABLED (Agent queue shows 'ARTIFICIAL INTELLIGENCE is under maintenance')";
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
        '<div class="who">' + escapeHtml(item.reference_no || "") + ' • ' + escapeHtml(item.actor) + ' <span class="muted" style="font-weight:400">(' + formatDate(item.created_at) + ')</span></div>' +
        '<div>' + escapeHtml(item.message) + '</div>' +
      '</div>';
  }
  box.innerHTML = html;
}

async function toggleAiMode() {
  var next = !isAiEnabled();
  setAiEnabled(next);
  await dbAddLog(currentAdmin.email, "Set AI Screening Engine to " + (next ? "ENABLED" : "DISABLED"));
  await refreshAdminData();
}

// 3. APIs Health Check
async function checkApiHealth() {
  var box = document.getElementById("api-health-list");
  if (!box) return;

  var pyOk = false;
  var pyNote = "Offline (Using browser fallback)";
  var apiUrl = CONFIG.API_URL || CONFIG.PYTHON_API_URL || "http://127.0.0.1:8001";
  try {
    var res = await fetch(apiUrl + "/health");
    if (res.ok) {
      var data = await res.json();
      pyOk = true;
      pyNote = "Online at " + apiUrl + " (OpenCV: " + (data.opencv ? "Ready" : "Off") + ")";
    }
  } catch (e) {}

  var supaOk = !IS_DEMO_MODE;
  var items = [
    {
      name: "Python FastAPI Server (OpenCV + PaddleOCR + Ollama)",
      status: pyOk ? "Connected" : "Fallback Mode",
      badge: pyOk ? "badge-green" : "badge-yellow",
      detail: pyNote
    },
    {
      name: "Supabase PostgreSQL + Auth + Storage",
      status: supaOk ? "Live Cloud" : "Local Demo Storage",
      badge: supaOk ? "badge-green" : "badge-blue",
      detail: supaOk ? CONFIG.SUPABASE_URL : "Running in local browser storage (zero setup required)"
    },
    {
      name: "Leaflet.js + OpenStreetMap + Nominatim Reverse Geocoding",
      status: "Active",
      badge: "badge-green",
      detail: "Grab-style map pinning & automatic address lookup enabled"
    },
    {
      name: "Resend Transactional Email Service",
      status: pyOk ? "Ready via FastAPI" : "Demo Inbox Preview",
      badge: pyOk ? "badge-green" : "badge-blue",
      detail: "Sends Reference Number, 6-Digit Activation OTP, and Status Updates"
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

// 4. Accounts Management
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
  var pw = document.getElementById("new-acc-pw").value || "demo123";
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

// 5. Activity & Login History Logs
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

// 6. Export CSV & Reset Demo Data
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
