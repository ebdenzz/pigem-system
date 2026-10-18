// ============================================================
// MANAGER DASHBOARD LOGIC (Application Monitoring Management)
// ============================================================

var currentManager = null;
var mgrApps = [];
var mgrUsers = [];
var activeMgrTab = "overview";
var activeMgrAppId = null;

window.addEventListener("DOMContentLoaded", async function () {
  currentManager = await requireLogin(["manager", "admin"]);
  if (!currentManager) return;

  document.getElementById("top-user-name").textContent = currentManager.full_name;
  await refreshManagerData();
  loadAllCmsEditors();
  initDashUI(currentManager, mgrApps, openMgrAppModal);
});

async function refreshManagerData() {
  mgrApps = await dbListAllApplications();
  mgrUsers = await dbListUsers();
  updateDashSearchApps(mgrApps);

  var pending = 0, fix = 0, approved = 0, rejected = 0;
  var planCounts = { "1000": 0, "1400": 0, "1900": 0 };

  for (var i = 0; i < mgrApps.length; i++) {
    var a = mgrApps[i];
    if (a.status === "Pending Review" || a.status === "Under Agent Review") pending++;
    else if (a.status === "Needs Correction") fix++;
    else if (a.status === "Approved" || a.status === "Submitted to Provider") approved++;
    else if (a.status === "Rejected") rejected++;

    if (String(a.plan_name).indexOf("1000") !== -1) planCounts["1000"]++;
    else if (String(a.plan_name).indexOf("1400") !== -1) planCounts["1400"]++;
    else if (String(a.plan_name).indexOf("1900") !== -1) planCounts["1900"]++;
  }

  document.getElementById("st-total").textContent = mgrApps.length;
  document.getElementById("st-pending").textContent = pending;
  document.getElementById("st-fix").textContent = fix;
  document.getElementById("st-approved").textContent = approved;

  renderBars("chart-mgr-bars", [
    { label: "Pending", value: pending, color: "#2563eb" },
    { label: "Needs Fix", value: fix, color: "#d97706" },
    { label: "Approved", value: approved, color: "#15803d" },
    { label: "Rejected", value: rejected, color: "#dc2626" }
  ]);
  renderColumns("chart-mgr-cols", [
    { label: "Plan 1000", value: planCounts["1000"], color: "#c8102e" },
    { label: "Plan 1400", value: planCounts["1400"], color: "#0f172a" },
    { label: "Plan 1900", value: planCounts["1900"], color: "#2563eb" }
  ]);
  renderCalendar("mgr-calendar", mgrApps);

  renderManagerApps();
  renderAgentPerformance();
  await renderManagerLinks();
}

function showTab(tab) {
  activeMgrTab = tab;
  var allNavs = [
    "overview",
    "app-all", "app-override", "app-encoded",
    "agent-perf", "agent-links",
    "cms-banners", "cms-assets", "cms-about", "cms-plans", "cms-faqs"
  ];
  for (var i = 0; i < allNavs.length; i++) {
    var btn = document.getElementById("nav-" + allNavs[i]);
    if (btn) btn.classList.toggle("active", allNavs[i] === tab);
  }

  var isAppView = (tab === "app-all" || tab === "app-override" || tab === "app-encoded");
  var isCmsView = (tab.indexOf("cms-") === 0);

  document.getElementById("tab-overview").classList.toggle("hidden", tab !== "overview");
  document.getElementById("tab-apps").classList.toggle("hidden", !isAppView);
  document.getElementById("tab-agent-perf").classList.toggle("hidden", tab !== "agent-perf");
  document.getElementById("tab-agent-links").classList.toggle("hidden", tab !== "agent-links");
  document.getElementById("tab-cms-banners").classList.toggle("hidden", tab !== "cms-banners");
  var tabAssets = document.getElementById("tab-cms-assets");
  if (tabAssets) tabAssets.classList.toggle("hidden", tab !== "cms-assets");
  document.getElementById("tab-cms-about").classList.toggle("hidden", tab !== "cms-about");
  document.getElementById("tab-cms-plans").classList.toggle("hidden", tab !== "cms-plans");
  document.getElementById("tab-cms-faqs").classList.toggle("hidden", tab !== "cms-faqs");

  // Auto-enable Maintenance Mode whenever the Manager opens any Content CMS tab
  var maintBar = document.getElementById("cms-maint-bar");
  if (maintBar) {
    maintBar.classList.toggle("hidden", !isCmsView);
    if (isCmsView) {
      if (!isMaintenanceOn()) {
        setMaintenanceOn(true);
        if (currentManager) {
          dbAddLog(currentManager.email, "Auto-enabled Maintenance Mode while editing Content CMS");
        }
      }
      updateCmsMaintenanceBarUI();
    }
  }

  if (isAppView) {
    var headings = {
      "app-all": "All Customer Applications",
      "app-override": "Applications Needing Override / Correction",
      "app-encoded": "Approved & Encoded Applications"
    };
    document.getElementById("mgr-apps-title").textContent = headings[tab];
    renderManagerApps();
  }
}

function updateCmsMaintenanceBarUI() {
  var badge = document.getElementById("cms-maint-badge");
  var btn = document.getElementById("cms-maint-toggle-btn");
  if (!badge || !btn) return;
  if (isMaintenanceOn()) {
    badge.className = "badge badge-yellow";
    badge.textContent = "Maintenance Mode: ON (Customers Blocked While Editing)";
    btn.textContent = "✓ Publish & Turn Off Maintenance";
  } else {
    badge.className = "badge badge-green";
    badge.textContent = "Website Live (Maintenance Mode: OFF)";
    btn.textContent = "🔒 Turn Maintenance Mode ON";
  }
}

function finishCmsAndDisableMaintenance() {
  if (isMaintenanceOn()) {
    setMaintenanceOn(false);
    if (currentManager) dbAddLog(currentManager.email, "Published CMS changes & turned OFF Maintenance Mode");
    updateCmsMaintenanceBarUI();
    showAlert("Website is Live", "Maintenance Mode is now OFF. Customers can access the public website, application form, and account activation.");
  } else {
    setMaintenanceOn(true);
    if (currentManager) dbAddLog(currentManager.email, "Turned ON Maintenance Mode from Content CMS");
    updateCmsMaintenanceBarUI();
  }
}

function renderManagerApps() {
  var box = document.getElementById("mgr-apps-list");
  if (!box) return;
  var q = (document.getElementById("mgr-filter") ? document.getElementById("mgr-filter").value : "").trim().toLowerCase();

  var list = [];
  for (var i = 0; i < mgrApps.length; i++) {
    var a = mgrApps[i];
    if (activeMgrTab === "app-override" && a.status !== "Needs Correction" && a.status !== "Rejected") continue;
    if (activeMgrTab === "app-encoded" && a.status !== "Approved" && a.status !== "Submitted to Provider" && !a.encoded) continue;
    if (q) {
      var hay = ((a.full_name || "") + " " + (a.reference_no || "") + " " + (a.assigned_agent || "") + " " + (a.city || "")).toLowerCase();
      if (hay.indexOf(q) === -1) continue;
    }
    list.push(a);
  }

  if (list.length === 0) {
    box.innerHTML = '<div class="card muted" style="text-align:center; padding:26px">No matching applications found.</div>';
    return;
  }

  var html = "";
  for (var j = 0; j < list.length; j++) {
    var app = list[j];
    html +=
      '<div class="q-card">' +
        '<div class="q-head">' +
          '<div>' +
            '<div class="q-name">' + escapeHtml(app.full_name) + ' <span class="muted" style="font-weight:500; font-size:12px">(' + escapeHtml(app.reference_no) + ')</span></div>' +
            '<div class="q-sub" style="margin-top:6px; display:flex; gap:8px; align-items:center; flex-wrap:wrap">' +
              statusBadge(app.status) +
              '<span class="badge badge-gray">Agent: ' + escapeHtml(app.assigned_agent || "Unassigned") + '</span>' +
              '<span class="muted">' + escapeHtml(app.plan_name) + ' • ' + escapeHtml(app.city || "") + '</span>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-red btn-sm" onclick="openMgrAppModal(\'' + escapeHtml(app.id) + '\')">Manage / Override</button>' +
        '</div>' +
      '</div>';
  }
  box.innerHTML = html;
}

function findMgrApp(id) {
  for (var i = 0; i < mgrApps.length; i++) {
    if (mgrApps[i].id === id) return mgrApps[i];
  }
  return null;
}

function openMgrAppModal(appId) {
  activeMgrAppId = appId;
  var app = findMgrApp(appId);
  if (!app) return;

  var agents = [];
  for (var i = 0; i < mgrUsers.length; i++) {
    if (mgrUsers[i].role === "agent") agents.push(mgrUsers[i]);
  }
  var agentOpts = '<option value="">— Unassigned —</option>';
  for (var j = 0; j < agents.length; j++) {
    var ag = agents[j];
    var sel = app.assigned_agent === ag.email ? "selected" : "";
    agentOpts += '<option value="' + escapeHtml(ag.email) + '" ' + sel + '>' + escapeHtml(ag.full_name + " (" + ag.email + ")") + '</option>';
  }

  document.getElementById("mgr-modal-title").textContent = app.reference_no + " — " + app.full_name;
  document.getElementById("mgr-modal-body").innerHTML =
    '<div class="grid-2">' +
      '<div class="kv">' +
        '<div><span>Current Status</span><b>' + statusBadge(app.status) + '</b></div>' +
        '<div><span>Plan</span><b>' + escapeHtml(app.plan_name) + '</b></div>' +
        '<div><span>Email &amp; Mobile</span><b>' + escapeHtml(app.email + " / " + app.phone) + '</b></div>' +
        '<div><span>Primary ID</span><b>' + escapeHtml(app.id_type + " — " + app.id_number) + '</b></div>' +
        '<div><span>Address</span><b>' + escapeHtml((app.street || "") + ", " + (app.barangay || "") + ", " + (app.city || "")) + '</b></div>' +
      '</div>' +
      '<div>' +
        '<div class="field"><label>Assign / Reassign Verification Agent</label><select id="mgr-assign-agent">' + agentOpts + '</select></div>' +
        '<div class="field">' +
          '<label>Override Application Status</label>' +
          '<select id="mgr-override-status">' +
            '<option value="Pending Review" ' + (app.status === "Pending Review" ? "selected" : "") + '>Pending Review</option>' +
            '<option value="Under Agent Review" ' + (app.status === "Under Agent Review" ? "selected" : "") + '>Under Agent Review</option>' +
            '<option value="Needs Correction" ' + (app.status === "Needs Correction" ? "selected" : "") + '>Needs Correction</option>' +
            '<option value="Approved" ' + (app.status === "Approved" ? "selected" : "") + '>Approved</option>' +
            '<option value="Submitted to Provider" ' + (app.status === "Submitted to Provider" ? "selected" : "") + '>Submitted to Provider (Encoded)</option>' +
            '<option value="Rejected" ' + (app.status === "Rejected" ? "selected" : "") + '>Rejected</option>' +
          '</select>' +
        '</div>' +
        '<div class="field"><label>Manager Remarks</label><textarea id="mgr-remarks" rows="2">' + escapeHtml(app.agent_remarks || "") + '</textarea></div>' +
        '<button type="button" class="btn btn-red" style="width:100%" onclick="saveMgrOverride()">Save Assignment &amp; Status Override</button>' +
      '</div>' +
    '</div>';

  document.getElementById("mgr-modal").classList.remove("hidden");
}

function closeMgrModal() {
  document.getElementById("mgr-modal").classList.add("hidden");
}

async function saveMgrOverride() {
  var app = findMgrApp(activeMgrAppId);
  if (!app) return;
  var agentEmail = document.getElementById("mgr-assign-agent").value;
  var newStatus = document.getElementById("mgr-override-status").value;
  var remarks = document.getElementById("mgr-remarks").value.trim();

  await dbUpdateApplication(app.id, {
    assigned_agent: agentEmail,
    status: newStatus,
    agent_remarks: remarks,
    encoded: (newStatus === "Approved" || newStatus === "Submitted to Provider") ? true : app.encoded
  });

  await dbAddAiLog(app.id, app.reference_no, "Manager (" + currentManager.full_name + ")", "Manager set status to " + newStatus + " (Agent: " + (agentEmail || "Unassigned") + ")");
  await dbAddLog(currentManager.email, "Manager updated " + app.reference_no + " -> " + newStatus);
  closeMgrModal();
  await refreshManagerData();
  showAlert("Saved", "Application " + app.reference_no + " has been updated.");
}

function renderAgentPerformance() {
  var body = document.getElementById("mgr-agent-body");
  if (!body) return;
  var html = "";
  for (var i = 0; i < mgrUsers.length; i++) {
    var u = mgrUsers[i];
    if (u.role !== "agent") continue;
    var active = 0, fix = 0, done = 0, total = 0;
    for (var j = 0; j < mgrApps.length; j++) {
      var a = mgrApps[j];
      if (a.assigned_agent === u.email) {
        total++;
        if (a.status === "Pending Review" || a.status === "Under Agent Review") active++;
        else if (a.status === "Needs Correction") fix++;
        else if (a.status === "Approved" || a.status === "Submitted to Provider") done++;
      }
    }
    html +=
      '<tr>' +
        '<td><b>' + escapeHtml(u.full_name) + '</b></td>' +
        '<td>' + escapeHtml(u.email) + '</td>' +
        '<td><span class="badge badge-blue">' + active + '</span></td>' +
        '<td><span class="badge badge-yellow">' + fix + '</span></td>' +
        '<td><span class="badge badge-green">' + done + '</span></td>' +
        '<td><b>' + total + '</b></td>' +
      '</tr>';
  }
  body.innerHTML = html || '<tr><td colspan="6" class="muted">No agents found.</td></tr>';
}

async function renderManagerLinks() {
  var body = document.getElementById("mgr-links-body");
  if (!body) return;
  var links = await dbListAgentLinks();
  if (links.length === 0) {
    body.innerHTML = '<tr><td colspan="4" class="muted">No referral links created yet.</td></tr>';
    return;
  }
  var html = "";
  for (var i = 0; i < links.length; i++) {
    var l = links[i];
    html +=
      '<tr>' +
        '<td><b>' + escapeHtml(l.code) + '</b></td>' +
        '<td>' + escapeHtml(l.agent_email) + '</td>' +
        '<td>' + escapeHtml(l.note) + '</td>' +
        '<td>' + formatDate(l.created_at) + '</td>' +
      '</tr>';
  }
  body.innerHTML = html;
}

// ============================================================
// CONTENT CMS EDITORS (4-Slide Hero Banners, Bucket Media Assets, About, Plans, FAQs)
// ============================================================

function ensureFourSlides(slides, fallbackSlides) {
  var arr = (slides || []).slice();
  var fb = fallbackSlides || [];
  while (arr.length < 4) {
    var nextFb = fb[arr.length] || { tag: "PIGEM FIBER", image: "Banners/home-banner-1.png", title: "Slide " + (arr.length + 1), text: "Update slide description here." };
    arr.push(Object.assign({}, nextFb));
  }
  return arr.slice(0, 4);
}

function loadAllCmsEditors() {
  var c = getSiteContent();
  var lib = c.asset_library || DEFAULT_CONTENT.asset_library;

  // 1. Hero Banners (4 Home + 4 About Slides with Bucket Banner Switcher)
  c.home_slides = ensureFourSlides(c.home_slides, DEFAULT_CONTENT.hero_slides);
  c.about_slides = ensureFourSlides(c.about_slides, DEFAULT_CONTENT.about_slides);
  renderSlideEditorList("cms-home-slides", "home", c.home_slides, lib.Banners || []);
  renderSlideEditorList("cms-about-slides", "about", c.about_slides, lib.Banners || []);

  // 2. Media & Bucket Assets (Logo, Clients, Vehicles, Permits)
  renderMediaAssetsEditor(c);

  // 3. About Company text
  document.getElementById("cms-about-lead").value = c.about_lead || "";
  document.getElementById("cms-about-s1").value = c.about_story_1 || "";
  document.getElementById("cms-about-s2").value = c.about_story_2 || "";
  document.getElementById("cms-contact-email").value = c.contact_email || "";
  document.getElementById("cms-contact-phone").value = c.contact_phone || "";
  document.getElementById("cms-contact-addr").value = c.contact_address || "";

  // 4. Plans
  var plansBox = document.getElementById("cms-plans-list");
  var plansHtml = "";
  var plans = c.plans || [];
  for (var i = 0; i < plans.length; i++) {
    var p = plans[i];
    plansHtml +=
      '<div class="card" style="margin-bottom:12px; background:var(--soft)">' +
        '<div class="grid-3">' +
          '<div class="field"><label>Plan Name</label><input id="pl-name-' + i + '" type="text" value="' + escapeHtml(p.name) + '" /></div>' +
          '<div class="field"><label>Speed (e.g. 100 Mbps)</label><input id="pl-speed-' + i + '" type="text" value="' + escapeHtml(p.speed) + '" /></div>' +
          '<div class="field"><label>Monthly Price (₱)</label><input id="pl-price-' + i + '" type="number" value="' + escapeHtml(p.price) + '" /></div>' +
        '</div>' +
        '<div class="field"><label>Features (comma-separated)</label><input id="pl-feat-' + i + '" type="text" value="' + escapeHtml((p.features || []).join(", ")) + '" /></div>' +
      '</div>';
  }
  plansBox.innerHTML = plansHtml;

  // 5. FAQs
  renderFaqEditorRows(c.faqs || []);
}

function renderSlideEditorList(boxId, prefix, slides, savedBanners) {
  var box = document.getElementById(boxId);
  if (!box) return;
  var html = "";
  for (var i = 0; i < slides.length; i++) {
    var s = slides[i];
    var currentImg = s.image || "Banners/home-banner-1.png";
    var allChoices = (savedBanners || []).slice();
    if (allChoices.indexOf(currentImg) === -1) allChoices.unshift(currentImg);

    var optionsHtml = "";
    for (var b = 0; b < allChoices.length; b++) {
      var path = allChoices[b];
      var label = path.indexOf("data:") === 0 ? ("Uploaded Image #" + (b + 1)) : path;
      var sel = (path === currentImg) ? "selected" : "";
      optionsHtml += '<option value="' + escapeHtml(path) + '" ' + sel + '>' + escapeHtml(label) + '</option>';
    }

    html +=
      '<div class="card" style="margin-bottom:10px; background:var(--soft)">' +
        '<div style="display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap">' +
          '<img id="' + prefix + '-prev-' + i + '" src="' + escapeHtml(getImageUrl(currentImg)) + '" onerror="imageFallback(this, \'' + escapeHtml(currentImg) + '\')" alt="Slide ' + (i + 1) + '" style="width:140px; height:82px; object-fit:cover; border-radius:8px; border:1px solid var(--line); background:#111" />' +
          '<div style="flex:1; min-width:260px">' +
            '<div class="grid-3">' +
              '<div class="field"><label>Slide ' + (i + 1) + ' Tag</label><input id="' + prefix + '-tag-' + i + '" type="text" value="' + escapeHtml(s.tag || "") + '" /></div>' +
              '<div class="field"><label>Headline Title</label><input id="' + prefix + '-title-' + i + '" type="text" value="' + escapeHtml(s.title || "") + '" /></div>' +
              '<div class="field">' +
                '<label>Switch Saved Banner from Bucket (' + allChoices.length + ' available)</label>' +
                '<select id="' + prefix + '-img-' + i + '" onchange="document.getElementById(\'' + prefix + '-prev-' + i + '\').src = getImageUrl(this.value)">' + optionsHtml + '</select>' +
              '</div>' +
            '</div>' +
            '<div class="field" style="margin-bottom:0"><label>Subtitle Text</label><input id="' + prefix + '-text-' + i + '" type="text" value="' + escapeHtml(s.text || "") + '" /></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  box.innerHTML = html;
}

function renderMediaAssetsEditor(c) {
  var lib = c.asset_library || DEFAULT_CONTENT.asset_library;

  // 1. Logo selector
  var logoSelect = document.getElementById("cms-active-logo");
  var logoPrev = document.getElementById("cms-logo-preview");
  if (logoSelect && logoPrev) {
    var logos = (lib.Logos || ["logo.png"]).slice();
    var activeLogo = c.logo_image || "logo.png";
    if (logos.indexOf(activeLogo) === -1) logos.unshift(activeLogo);
    logoSelect.innerHTML = logos.map(function (p, idx) {
      var lbl = p.indexOf("data:") === 0 ? ("Uploaded Logo #" + (idx + 1)) : p;
      return '<option value="' + escapeHtml(p) + '" ' + (p === activeLogo ? "selected" : "") + '>' + escapeHtml(lbl) + '</option>';
    }).join("");
    logoPrev.src = getImageUrl(activeLogo);
  }

  // 2. Checkable galleries for Clients, Vehicles, Permits
  renderAssetCheckboxGallery("cms-clients-gallery", "client", lib.Clients || [], c.client_images || []);
  renderAssetCheckboxGallery("cms-vehicles-gallery", "vehicle", lib.Vehicles || [], c.vehicle_images || []);
  renderAssetCheckboxGallery("cms-permits-gallery", "permit", lib.Permits || [], c.permit_images || []);
}

function renderAssetCheckboxGallery(boxId, groupName, allSaved, activeList) {
  var box = document.getElementById(boxId);
  if (!box) return;
  var merged = (allSaved || []).slice();
  for (var i = 0; i < (activeList || []).length; i++) {
    if (merged.indexOf(activeList[i]) === -1) merged.push(activeList[i]);
  }
  var html = "";
  for (var j = 0; j < merged.length; j++) {
    var path = merged[j];
    var checked = (activeList || []).indexOf(path) !== -1 ? "checked" : "";
    var shortLabel = path.indexOf("data:") === 0 ? ("Uploaded #" + (j + 1)) : path;
    html +=
      '<label class="card" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; margin:0">' +
        '<input type="checkbox" name="cms-asset-' + groupName + '" value="' + escapeHtml(path) + '" ' + checked + ' style="width:18px; height:18px" />' +
        '<img src="' + escapeHtml(getImageUrl(path)) + '" onerror="imageFallback(this, \'' + escapeHtml(path) + '\')" alt="" style="width:56px; height:42px; object-fit:contain; border:1px solid var(--line); border-radius:6px; background:#fff; padding:2px" />' +
        '<span style="font-size:12px; word-break:break-all">' + escapeHtml(shortLabel) + '</span>' +
      '</label>';
  }
  box.innerHTML = html;
}

async function uploadNewBucketAsset(category, fileInputId, msgId) {
  var inp = document.getElementById(fileInputId);
  var file = inp && inp.files ? inp.files[0] : null;
  if (!file) {
    showMsg(msgId, "err", "Please choose an image file from your computer first.");
    return;
  }
  try {
    showMsg(msgId, "info", "Uploading " + file.name + " to website-assets/" + category + "...");
    var savedPath = await dbUploadWebsiteAsset(file, category);
    var c = getSiteContent();
    if (category === "Logos") {
      c.logo_image = savedPath;
    } else if (category === "Clients") {
      c.client_images = c.client_images || [];
      if (c.client_images.indexOf(savedPath) === -1) c.client_images.push(savedPath);
    } else if (category === "Vehicles") {
      c.vehicle_images = c.vehicle_images || [];
      if (c.vehicle_images.indexOf(savedPath) === -1) c.vehicle_images.push(savedPath);
    } else if (category === "Permits") {
      c.permit_images = c.permit_images || [];
      if (c.permit_images.indexOf(savedPath) === -1) c.permit_images.push(savedPath);
    }
    saveSiteContent(c);
    inp.value = "";
    loadAllCmsEditors();
    showMsg(msgId, "ok", "Uploaded to bucket (" + savedPath + ")! It is now saved in your bucket library and ready to select.");
  } catch (e) {
    showMsg(msgId, "err", e.message || "Upload failed.");
  }
}

function saveMediaAssetsCms() {
  var c = getSiteContent();
  var logoSel = document.getElementById("cms-active-logo");
  if (logoSel && logoSel.value) c.logo_image = logoSel.value;

  c.client_images = getCheckedAssetValues("client");
  c.vehicle_images = getCheckedAssetValues("vehicle");
  c.permit_images = getCheckedAssetValues("permit");

  saveSiteContent(c);
  loadPageImages();
  dbAddLog(currentManager.email, "Updated active Logo, Clients, Vehicles & Permits in Content CMS");
  showMsg("cms-assets-msg", "ok", "Active Website Assets saved to Supabase! Click 'Preview Live Website' above to view.");
}

function getCheckedAssetValues(groupName) {
  var boxes = document.querySelectorAll('input[name="cms-asset-' + groupName + '"]:checked');
  var out = [];
  for (var i = 0; i < boxes.length; i++) out.push(boxes[i].value);
  return out;
}

function saveBannersCms() {
  var c = getSiteContent();
  c.home_slides = ensureFourSlides(c.home_slides, DEFAULT_CONTENT.hero_slides);
  c.about_slides = ensureFourSlides(c.about_slides, DEFAULT_CONTENT.about_slides);

  for (var i = 0; i < 4; i++) {
    c.home_slides[i].tag = document.getElementById("home-tag-" + i).value.trim();
    c.home_slides[i].title = document.getElementById("home-title-" + i).value.trim();
    c.home_slides[i].image = document.getElementById("home-img-" + i).value.trim();
    c.home_slides[i].text = document.getElementById("home-text-" + i).value.trim();
  }
  for (var j = 0; j < 4; j++) {
    c.about_slides[j].tag = document.getElementById("about-tag-" + j).value.trim();
    c.about_slides[j].title = document.getElementById("about-title-" + j).value.trim();
    c.about_slides[j].image = document.getElementById("about-img-" + j).value.trim();
    c.about_slides[j].text = document.getElementById("about-text-" + j).value.trim();
  }
  saveSiteContent(c);
  dbAddLog(currentManager.email, "Updated 4 Home & 4 About Hero Banners in Content CMS");
  showMsg("cms-banners-msg", "ok", "4-Slide Hero Banners saved to Supabase! Click 'Preview Live Website' to inspect.");
}

function saveAboutCms() {
  var c = getSiteContent();
  c.about_lead = document.getElementById("cms-about-lead").value.trim();
  c.about_story_1 = document.getElementById("cms-about-s1").value.trim();
  c.about_story_2 = document.getElementById("cms-about-s2").value.trim();
  c.contact_email = document.getElementById("cms-contact-email").value.trim();
  c.contact_phone = document.getElementById("cms-contact-phone").value.trim();
  c.contact_address = document.getElementById("cms-contact-addr").value.trim();
  saveSiteContent(c);
  dbAddLog(currentManager.email, "Updated About PIGEM text in Content CMS");
  showMsg("cms-about-msg", "ok", "About PIGEM & Contact information saved to Supabase!");
}

function savePlansCms() {
  var c = getSiteContent();
  for (var i = 0; i < c.plans.length; i++) {
    c.plans[i].name = document.getElementById("pl-name-" + i).value.trim();
    c.plans[i].speed = document.getElementById("pl-speed-" + i).value.trim();
    c.plans[i].price = Number(document.getElementById("pl-price-" + i).value) || c.plans[i].price;
    var feats = document.getElementById("pl-feat-" + i).value.split(",");
    var cleanFeats = [];
    for (var f = 0; f < feats.length; f++) {
      if (feats[f].trim()) cleanFeats.push(feats[f].trim());
    }
    c.plans[i].features = cleanFeats;
  }
  saveSiteContent(c);
  dbAddLog(currentManager.email, "Updated Red Fiber Plans in Content CMS");
  showMsg("cms-plans-msg", "ok", "Internet Plans saved to Supabase!");
}

var currentEditingFaqs = [];
function renderFaqEditorRows(faqs) {
  currentEditingFaqs = faqs.slice();
  var box = document.getElementById("cms-faqs-list");
  var html = "";
  for (var i = 0; i < currentEditingFaqs.length; i++) {
    html +=
      '<div class="card" style="margin-bottom:10px; background:var(--soft)">' +
        '<div class="field"><label>Question #' + (i + 1) + '</label><input id="faq-q-' + i + '" type="text" value="' + escapeHtml(currentEditingFaqs[i].q) + '" /></div>' +
        '<div class="field"><label>Answer</label><textarea id="faq-a-' + i + '" rows="2">' + escapeHtml(currentEditingFaqs[i].a) + '</textarea></div>' +
      '</div>';
  }
  box.innerHTML = html;
}

function addFaqCmsRow() {
  syncFaqInputs();
  currentEditingFaqs.push({ q: "New Question?", a: "Write the answer here." });
  renderFaqEditorRows(currentEditingFaqs);
}

function syncFaqInputs() {
  for (var i = 0; i < currentEditingFaqs.length; i++) {
    var qEl = document.getElementById("faq-q-" + i);
    var aEl = document.getElementById("faq-a-" + i);
    if (qEl && aEl) {
      currentEditingFaqs[i].q = qEl.value.trim();
      currentEditingFaqs[i].a = aEl.value.trim();
    }
  }
}

function saveFaqsCms() {
  syncFaqInputs();
  var c = getSiteContent();
  c.faqs = currentEditingFaqs.filter(function (item) { return item.q !== ""; });
  saveSiteContent(c);
  dbAddLog(currentManager.email, "Updated FAQs in Content CMS");
  showMsg("cms-faqs-msg", "ok", "FAQs saved to Supabase!");
}

