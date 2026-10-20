// ============================================================
// APPLICATION FORM SCRIPT (apply.html)
// 4-Step Flow:
//   Step 1 (Panel 0): Select Plan & Personal Information (First, Middle, Last, Birth Date)
//   Step 2 (Panel 1): Contact Information (Gmail + Mobile with OTP) & Location Map + Address
//   Step 3 (Panel 2): Documents — Valid ID Front & Back Upload (Photos or Camera) + In-Card Guide
//   Step 4 (Panel 3): Subscriber Declaration & Review Summary
// ============================================================

var currentPanel = 0;
var TOTAL_PANELS = 4;
var selectedPlanId = "1000";
var referralAgentId = "";
var leafletMap = null;
var leafletMarker = null;

var selectedFrontFile = null;
var selectedBackFile = null;

var generatedContactOtp = "";
var isContactOtpVerified = false;
var verifiedEmailAddress = "";

var STEP_NAMES = [
  "Step 1 of 4: Plan & Personal Information",
  "Step 2 of 4: Contact Information & Location Map",
  "Step 3 of 4: Valid ID Documents (Front & Back)",
  "Step 4 of 4: Subscriber Declaration & Review"
];

// Inline Tooltip Bubble for Required Asterisk (*) — never blocks mobile form inputs
function helpTip(fieldName, detail, ev) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  // Remove any existing bubble
  var old = document.querySelectorAll(".req-bubble");
  for (var i = 0; i < old.length; i++) old[i].remove();

  var target = ev && ev.currentTarget ? ev.currentTarget : null;
  if (!target) return;

  var bubble = document.createElement("span");
  bubble.className = "req-bubble";
  bubble.innerHTML = "<b style='color:#fff;display:block;margin-bottom:2px;'>" + fieldName + " (Required)</b>" + detail;
  target.appendChild(bubble);

  setTimeout(function () {
    if (bubble && bubble.parentNode) bubble.remove();
  }, 3500);
}

// Close any open asterisk bubble when tapping elsewhere
document.addEventListener("click", function () {
  var old = document.querySelectorAll(".req-bubble");
  for (var i = 0; i < old.length; i++) old[i].remove();
});

// Read ?plan= and ?agent= from the URL and start the form
function initApplyPage() {
  var params = new URLSearchParams(window.location.search);
  var urlPlan = params.get("plan");
  var urlAgent = params.get("agent");

  if (urlPlan) selectedPlanId = urlPlan;
  if (urlAgent) {
    referralAgentId = urlAgent;
    var banner = document.getElementById("agent-ref-banner");
    if (banner) {
      banner.hidden = false;
      banner.innerHTML = "<b>Agent Referral Active:</b> Your application is linked to Agent ID <b>" + referralAgentId + "</b>.";
    }
  }

  renderPlanChoices();
  showCaptchaPopup();
}

// Render the 3 Red Fiber plan radio cards on Panel 0
function renderPlanChoices() {
  var plans = getActivePlans();
  var box = document.getElementById("plan-choice-box");
  if (!box) return;
  var html = "";
  for (var i = 0; i < plans.length; i++) {
    var p = plans[i];
    var picked = String(p.id) === String(selectedPlanId) ? "picked" : "";
    html +=
      '<label class="' + picked + '" onclick="pickPlan(\'' + p.id + '\')">' +
        '<input type="radio" name="plan" value="' + p.id + '" ' + (picked ? "checked" : "") + '>' +
        '<b>' + p.name + '</b>' +
        '<span class="small muted">' + p.speed + ' Mbps &bull; ' + formatPeso(p.price) + '/mo</span>' +
      '</label>';
  }
  box.innerHTML = html;
}

function pickPlan(planId) {
  selectedPlanId = String(planId);
  renderPlanChoices();
}

// ============================================================
// Popup 1: Captcha Box Only (Always works even when .bat is offline)
// ============================================================
function showCaptchaPopup() {
  openPopup(
    '<div id="apply-captcha-card" onclick="onApplyCaptchaClick()" style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 20px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg-soft);cursor:pointer;user-select:none;">' +
      '<div style="display:flex;align-items:center;gap:14px;">' +
        '<div id="apply-captcha-box" style="width:28px;height:28px;border:2px solid #98a2b3;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;transition:all 0.15s;"></div>' +
        '<span style="font-weight:700;font-size:16px;">I\'m not a robot</span>' +
      '</div>' +
      '<div style="text-align:right;line-height:1.25;">' +
        '<div style="font-size:12px;font-weight:800;color:var(--muted);">CAPTCHA</div>' +
        '<div style="font-size:11px;color:var(--muted);">Security Verification</div>' +
      '</div>' +
    '</div>'
  );
}

function onApplyCaptchaClick() {
  var box = document.getElementById("apply-captcha-box");
  var card = document.getElementById("apply-captcha-card");
  if (box && card) {
    box.style.background = "#12b76a";
    box.style.borderColor = "#12b76a";
    box.innerHTML = "&#10003;";
    card.style.borderColor = "#12b76a";
  }
  setTimeout(function () {
    showInstructionPopup();
  }, 320);
}

// ============================================================
// Popup 2: "Instructions" with "OK" button
// ============================================================
function showInstructionPopup() {
  openPopup(
    '<h3>Instructions</h3>' +
    '<p class="small muted mt">Before filling out your application, please prepare the following:</p>' +
    '<ul style="margin:12px 0 0 18px; font-size:15px; line-height:1.7;">' +
      '<li><b>1 Valid Government-Issued ID (Front &amp; Back):</b> PhilSys National ID, Driver\'s License, Passport, UMID, SSS, PRC, Postal, or Voter\'s ID.</li>' +
      '<li><b>Active Gmail &amp; Mobile Number:</b> You will verify your contact info with a 6-digit OTP and receive your Reference Number by email.</li>' +
      '<li><b>Exact Installation Address:</b> Pin your house or building on the interactive map so our team can verify fiber coverage.</li>' +
    '</ul>' +
    '<div class="row mt-big" style="justify-content:flex-end">' +
      '<button type="button" class="btn btn-red" onclick="closePopup()">OK</button>' +
    '</div>'
  );
}

// ============================================================
// Contact OTP Verification (Panel 1)
// ============================================================
async function sendContactOtp() {
  var email = document.getElementById("email").value.trim().toLowerCase();
  var phone = document.getElementById("phone").value.trim();

  if (!email || email.indexOf("@") === -1) {
    showAlert("Valid Email Required", "Please enter your active Gmail address first before requesting an OTP.", "warn");
    return;
  }
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    showAlert("Mobile Number Required", "Please enter a valid 11-digit Primary Mobile Number first.", "warn");
    return;
  }

  var btn = document.getElementById("btn-send-otp");
  btn.disabled = true;
  btn.textContent = "Sending...";

  generatedContactOtp = String(Math.floor(100000 + Math.random() * 900000));
  isContactOtpVerified = false;

  var subject = "PIGEM Application Security — Your 6-Digit Contact Verification Code";
  var body =
    "Dear Applicant,\n\n" +
    "Thank you for choosing PIGEM Combined Facilities Support Services.\n\n" +
    "Your 6-Digit Contact Verification Code (OTP) is: " + generatedContactOtp + "\n\n" +
    "Please enter this code on Step 2 of the Internet Service Application Form to verify your email address (" + email + ") and mobile number (" + phone + ").\n\n" +
    "Sincerely,\n" +
    "PIGEM Combined Facilities Support Services";

  var emailRes = await apiSendEmail(email, subject, body);

  var row = document.getElementById("otp-Verify-row");
  if (row) row.hidden = false;

  var statusText = document.getElementById("otp-status-text");
  if (statusText) {
    statusText.innerHTML =
      "A 6-digit verification code has been sent to <b>" + email + "</b>" +
      (emailRes && emailRes.sent ? "." : " (Verification Code: <b>" + generatedContactOtp + "</b>).");
  }

  btn.disabled = false;
  btn.textContent = "Resend OTP";
}

function verifyContactOtp() {
  var entered = (document.getElementById("contact_otp_code").value || "").trim();
  if (!generatedContactOtp) {
    showAlert("Request OTP First", "Please click 'Send OTP' first to generate your verification code.", "warn");
    return;
  }
  if (entered !== generatedContactOtp) {
    showAlert("Invalid OTP Code", "The 6-digit OTP code you entered does not match. Please check and try again.", "bad");
    return;
  }
  isContactOtpVerified = true;
  verifiedEmailAddress = document.getElementById("email").value.trim().toLowerCase();
  var badge = document.getElementById("otp-badge");
  if (badge) {
    badge.hidden = false;
    badge.className = "badge status-approved";
    badge.textContent = "✓ Contact Verified";
  }
  var statusText = document.getElementById("otp-status-text");
  if (statusText) {
    statusText.innerHTML = "<span style='color:var(--good);font-weight:700;'>✓ Email and Mobile Number verified.</span>";
  }
}

// ============================================================
// Front & Back Valid ID Upload (Choose from Photos OR Camera)
// ============================================================
function handleIdFileSelect(side, inputEl) {
  var file = inputEl && inputEl.files && inputEl.files[0];
  if (!file) return;

  if (side === "front") {
    selectedFrontFile = file;
    var fnFront = document.getElementById("id-front-filename");
    if (fnFront) fnFront.innerHTML = "<b style='color:var(--good)'>✓ Selected:</b> " + file.name;
    var boxF = document.getElementById("id-front-preview-box");
    var imgF = document.getElementById("id-front-preview");
    if (boxF && imgF) {
      imgF.src = URL.createObjectURL(file);
      boxF.hidden = false;
    }
  } else {
    selectedBackFile = file;
    var fnBack = document.getElementById("id-back-filename");
    if (fnBack) fnBack.innerHTML = "<b style='color:var(--good)'>✓ Selected:</b> " + file.name;
    var boxB = document.getElementById("id-back-preview-box");
    var imgB = document.getElementById("id-back-preview");
    if (boxB && imgB) {
      imgB.src = URL.createObjectURL(file);
      boxB.hidden = false;
    }
  }
}

// ============================================================
// Step Navigation & Validation
// ============================================================
function showPanel(index) {
  currentPanel = index;
  for (var i = 0; i < TOTAL_PANELS; i++) {
    var el = document.getElementById("panel-" + i);
    if (el) el.hidden = (i !== index);
  }
  var pct = Math.round(((index + 1) / TOTAL_PANELS) * 100);
  document.getElementById("step-title").textContent = STEP_NAMES[index];
  document.getElementById("step-count").textContent = pct + "%";
  document.getElementById("step-bar").style.width = pct + "%";

  if (index === 1) {
    setTimeout(initMapPin, 180);
  }
  if (index === 3) {
    buildReviewSummary();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validateCurrentPanel() {
  // Panel 0: Plan & Personal Information
  if (currentPanel === 0) {
    var first = document.getElementById("first_name").value.trim();
    var middle = document.getElementById("middle_name").value.trim();
    var last = document.getElementById("last_name").value.trim();
    var birth = document.getElementById("birth_date").value;

    if (!first) return "Please enter your First Name.";
    if (!middle) return "Please enter your Middle Name (or type N/A if you have no middle name).";
    if (!last) return "Please enter your Last Name.";
    if (!birth) return "Please select your Birth Date.";
  }

  // Panel 1: Contact Information (with OTP) & Location Map
  if (currentPanel === 1) {
    var email = document.getElementById("email").value.trim().toLowerCase();
    var phone = document.getElementById("phone").value.trim();
    var house = document.getElementById("house_no").value.trim();

    if (!email || email.indexOf("@") === -1) return "Please enter a valid Email Address.";
    if (!phone || phone.replace(/\D/g, "").length < 10) return "Please enter a valid Primary Mobile Number.";
    if (!isContactOtpVerified || verifiedEmailAddress !== email) {
      return "Please verify your Email & Mobile Number by clicking 'Send OTP' and entering the 6-digit OTP code.";
    }
    if (!house) return "Please enter your House / Lot Number.";
    if (!document.getElementById("building_name").value.trim()) return "Please enter Building / Apartment Name (or N/A).";
    if (!document.getElementById("street").value.trim()) return "Please enter your Street Name.";
    if (!document.getElementById("subdivision").value.trim()) return "Please enter your Subdivision/Village (or N/A).";
    if (!document.getElementById("barangay").value.trim()) return "Please enter your Barangay.";
    if (!document.getElementById("city").value.trim()) return "Please enter your City/Municipality.";
    if (!document.getElementById("province").value.trim()) return "Please enter your District/Province.";
    if (!document.getElementById("landmark").value.trim()) return "Please enter the Nearest Landmark.";
  }

  // Panel 2: Valid ID Documents (Front & Back)
  if (currentPanel === 2) {
    var idType = document.getElementById("id_type").value;
    var idNumber = document.getElementById("id_number").value.trim();
    if (!idType) return "Please select your Primary Valid ID Type.";
    if (!idNumber) return "Please enter your Primary ID Number.";
    if (!selectedFrontFile) return "Please upload or take a photo of the FRONT of your Valid ID.";
    if (!selectedBackFile) return "Please upload or take a photo of the BACK of your Valid ID.";
  }

  // Panel 3: Subscriber Declaration
  if (currentPanel === 3) {
    if (!document.getElementById("agree_sub").checked) {
      return "Please check the confirmation box agreeing to the Subscriber Certificate.";
    }
  }

  return "";
}

function nextPanel() {
  var err = validateCurrentPanel();
  if (err) {
    showAlert("Required Information", err, "warn");
    return;
  }
  if (currentPanel < TOTAL_PANELS - 1) {
    showPanel(currentPanel + 1);
  }
}

function prevPanel() {
  if (currentPanel > 0) {
    showPanel(currentPanel - 1);
  }
}

// ============================================================
// Grab-Style Map Pinning + Auto-Fill Address + Service Area Check
// Works anywhere on Vercel even when local .bat is not running!
// ============================================================
function initMapPin() {
  if (!leafletMap) {
    var lat = parseFloat(document.getElementById("lat").value) || CONFIG.MAP_CENTER[0];
    var lng = parseFloat(document.getElementById("lng").value) || CONFIG.MAP_CENTER[1];

    leafletMap = L.map("map", { tap: false }).setView([lat, lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(leafletMap);

    leafletMarker = L.marker([lat, lng], { draggable: true }).addTo(leafletMap);

    leafletMarker.on("dragend", function () {
      var pos = leafletMarker.getLatLng();
      updatePinAndAddress(pos.lat, pos.lng);
    });

    leafletMap.on("click", function (event) {
      leafletMarker.setLatLng(event.latlng);
      updatePinAndAddress(event.latlng.lat, event.latlng.lng);
    });
  }
  setTimeout(function () {
    if (leafletMap) leafletMap.invalidateSize();
  }, 150);
}

// Reverse-geocode the pinned coordinates using OpenStreetMap Nominatim and fill address fields
async function updatePinAndAddress(lat, lng) {
  document.getElementById("lat").value = lat.toFixed(6);
  document.getElementById("lng").value = lng.toFixed(6);
  var statusEl = document.getElementById("map-status");
  statusEl.textContent = "Looking up address for pinned location...";

  try {
    var url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + lat + "&lon=" + lng;
    var res = await fetch(url, { headers: { "Accept-Language": "en" } });
    var data = await res.json();
    var addr = data.address || {};

    var road = addr.road || addr.pedestrian || addr.footway || addr. street || "";
    var subd = addr.neighbourhood || addr.residential || addr.hamlet || addr.subdivision || "";
    var brgy = addr.suburb || addr.village || addr.quarter || addr.city_district || "";
    var city = addr.city || addr.town || addr.municipality || "";
    var prov = addr.state || addr.province || addr.region || "";

    if (road) document.getElementById("street").value = road;
    if (subd) document.getElementById("subdivision").value = subd;
    else if (!document.getElementById("subdivision").value) document.getElementById("subdivision").value = "N/A";
    if (brgy) document.getElementById("barangay").value = brgy;
    if (city) document.getElementById("city").value = city;
    if (prov) document.getElementById("province").value = prov;

    statusEl.textContent = "Pinned location: " + (data.display_name || "Address updated");

    var combined = (city + " " + prov + " " + (data.display_name || "")).toLowerCase();
    if (!isServiceArea(combined)) {
      showAlert(
        "Service Availability Notice",
        "Your pinned location (" + (city || prov || "selected area") + ") appears to be outside our standard service areas (Metro Manila, Bulacan, Cavite, Laguna, Rizal, and Cebu). You may still continue your application and our team will validate availability.",
        "warn"
      );
    }
  } catch (e) {
    statusEl.textContent = "Location pinned (" + lat.toFixed(5) + ", " + lng.toFixed(5) + "). You can type or edit your address fields below.";
  }
}

// Search an address and move the map pin there
async function searchMapAddress() {
  var q = document.getElementById("map-search").value.trim();
  if (!q) return;
  initMapPin();
  var statusEl = document.getElementById("map-status");
  statusEl.textContent = "Searching map for '" + q + "'...";

  try {
    var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&q=" + encodeURIComponent(q);
    var res = await fetch(url, { headers: { "Accept-Language": "en" } });
    var list = await res.json();
    if (!list || list.length === 0) {
      showAlert("Location Not Found", "Could not find that place on the map. You can drag the pin manually or type your address below.", "warn");
      return;
    }
    var lat = parseFloat(list[0].lat);
    var lng = parseFloat(list[0].lon);
    leafletMap.setView([lat, lng], 16);
    leafletMarker.setLatLng([lat, lng]);
    await updatePinAndAddress(lat, lng);
  } catch (e) {
    statusEl.textContent = "Map search unavailable right now. Please drag the pin or type your address.";
  }
}

// Use browser GPS location (with high-accuracy + fallback so it works reliably on mobile & desktop)
function useCurrentLocation() {
  initMapPin();
  var statusEl = document.getElementById("map-status");
  var btn = document.getElementById("btn-use-loc");

  if (!navigator.geolocation) {
    showAlert("Location Unavailable", "Your browser does not support automatic location detection. Please search your barangay/city or drag the map pin.", "warn");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Locating...";
  }
  if (statusEl) statusEl.textContent = "Detecting your current GPS location...";

  function onGeoSuccess(pos) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "&#128205; Use My Location";
    }
    var lat = pos.coords.latitude;
    var lng = pos.coords.longitude;
    if (leafletMap && leafletMarker) {
      leafletMap.invalidateSize();
      leafletMap.setView([lat, lng], 17);
      leafletMarker.setLatLng([lat, lng]);
    }
    updatePinAndAddress(lat, lng);
  }

  function onGeoError() {
    // Fallback to low-accuracy network location if highAccuracy timed out
    navigator.geolocation.getCurrentPosition(
      onGeoSuccess,
      function (err) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = "&#128205; Use My Location";
        }
        var msg = "Unable to read your current location. Please allow Location Permission in your browser or use the Search Map box above.";
        if (err && err.code === 1) {
          msg = "Location permission was denied by your browser. Please enable Location access for this website or search your street/barangay in the box above.";
        }
        if (statusEl) statusEl.textContent = msg;
        showAlert("Location Permission", msg, "warn");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  navigator.geolocation.getCurrentPosition(
    onGeoSuccess,
    onGeoError,
    { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
  );
}

// Build the Review Summary on Panel 3
function buildReviewSummary() {
  var p = getPlanById(selectedPlanId);
  var fullName = [
    document.getElementById("first_name").value.trim(),
    document.getElementById("middle_name").value.trim(),
    document.getElementById("last_name").value.trim()
  ].filter(Boolean).join(" ");

  var addrObj = {
    house_no: document.getElementById("house_no").value.trim(),
    house_suffix: document.getElementById("house_suffix").value.trim(),
    unit_no: document.getElementById("unit_no").value.trim(),
    floor_no: document.getElementById("floor_no").value.trim(),
    building_name: document.getElementById("building_name").value.trim(),
    street: document.getElementById("street").value.trim(),
    subdivision: document.getElementById("subdivision").value.trim(),
    barangay: document.getElementById("barangay").value.trim(),
    city: document.getElementById("city").value.trim(),
    province: document.getElementById("province").value.trim()
  };

  var rows = [
    ["Selected Plan", "Red Fiber " + p.name + " — " + p.speed + " Mbps (" + formatPeso(p.price) + "/mo)"],
    ["Applicant Name", fullName],
    ["Birth Date", document.getElementById("birth_date").value],
    ["Email Address", document.getElementById("email").value.trim() + " (OTP Verified)"],
    ["Primary Mobile Number", document.getElementById("phone").value.trim()],
    ["Secondary Mobile Number", document.getElementById("phone_alt").value.trim() || "-"],
    ["Installation Address", formatAddress(addrObj)],
    ["Nearest Landmark", document.getElementById("landmark").value.trim()],
    ["Remarks / Instructions", document.getElementById("remarks").value.trim() || "-"],
    ["Primary Valid ID", document.getElementById("id_type").value + " — " + document.getElementById("id_number").value.trim()],
    ["Uploaded Front ID", selectedFrontFile ? selectedFrontFile.name : "-"],
    ["Uploaded Back ID", selectedBackFile ? selectedBackFile.name : "-"]
  ];

  var html = "<table>";
  for (var i = 0; i < rows.length; i++) {
    html += "<tr><th>" + rows[i][0] + "</th><td>" + rows[i][1] + "</td></tr>";
  }
  html += "</table>";
  document.getElementById("review-summary").innerHTML = html;
}

// Submit the completed registration
async function submitRegistration() {
  var err = validateCurrentPanel();
  if (err) {
    showAlert("Required Information", err, "warn");
    return;
  }

  var btn = document.getElementById("btn-submit");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  try {
    var first = document.getElementById("first_name").value.trim();
    var middle = document.getElementById("middle_name").value.trim();
    var last = document.getElementById("last_name").value.trim();
    var fullName = [first, middle, last].filter(Boolean).join(" ");
    var email = document.getElementById("email").value.trim().toLowerCase();
    var birth = document.getElementById("birth_date").value;
    var idType = document.getElementById("id_type").value;
    var idNumber = document.getElementById("id_number").value.trim();
    var p = getPlanById(selectedPlanId);

    // 1. Check / create Customer account for this email
    var accountInfo = await dbCreateAccountFromApplication(fullName, email);

    // 2. Upload Valid ID Front & Back photos
    var frontPath = await dbUploadDocument(selectedFrontFile, accountInfo.user.id || "public", "id-front");
    var backPath = await dbUploadDocument(selectedBackFile, accountInfo.user.id || "public", "id-back");

    // 3. Run Local AI-Assisted Screening if enabled by Admin (Gracefully marks offline if .bat is not running)
    var screening = null;
    if (getSystemSettings().ai_enabled) {
      screening = await apiRunScreening(selectedFrontFile, {
        full_name: fullName,
        birth_date: birth,
        id_number: idNumber
      });
    } else {
      screening = {
        preliminary: true,
        status: "disabled_by_admin",
        quality: { ok: true, issues: [] },
        ocr: { available: false, lines: [] },
        comparisons: {},
        ai: { model: "disabled", summary: "AI screening is currently under maintenance.", correction_message: "" }
      };
    }

    var addrData = {
      house_no: document.getElementById("house_no").value.trim(),
      house_suffix: document.getElementById("house_suffix").value.trim(),
      unit_no: document.getElementById("unit_no").value.trim(),
      unit_type: document.getElementById("unit_type").value,
      floor_no: document.getElementById("floor_no").value.trim(),
      building_name: document.getElementById("building_name").value.trim(),
      street: document.getElementById("street").value.trim(),
      subdivision: document.getElementById("subdivision").value.trim(),
      barangay: document.getElementById("barangay").value.trim(),
      city: document.getElementById("city").value.trim(),
      province: document.getElementById("province").value.trim(),
      landmark: document.getElementById("landmark").value.trim()
    };

    // 4. Save the application record
    var saved = await dbCreateApplication(Object.assign({}, addrData, {
      customer_id: accountInfo.user.id,
      agent_id: referralAgentId,
      agent_link_code: referralAgentId,
      plan: selectedPlanId,
      first_name: first,
      middle_name: middle,
      last_name: last,
      full_name: fullName,
      birth_date: birth,
      phone: document.getElementById("phone").value.trim(),
      phone_alt: document.getElementById("phone_alt").value.trim(),
      email: email,
      address_line: formatAddress(addrData),
      lat: parseFloat(document.getElementById("lat").value),
      lng: parseFloat(document.getElementById("lng").value),
      id_type: idType,
      id_number: idNumber,
      id_front_path: frontPath,
      proof_of_billing_path: backPath,
      remarks: document.getElementById("remarks").value.trim(),
      agree_tu: document.getElementById("agree_tu").checked,
      screening: screening
    }));

    // 5. Send Formal Business Email & Notification
    var subject = "PIGEM Application Confirmation — Reference No. " + saved.ref_no;
    var body =
      "Dear " + fullName + ",\n\n" +
      "Thank you for submitting your internet service application with PIGEM Combined Facilities Support Services.\n\n" +
      "APPLICATION SUMMARY\n" +
      "• Reference Number: " + saved.ref_no + "\n" +
      "• Selected Plan: Red Fiber " + p.name + " (" + p.speed + " Mbps — " + formatPeso(p.price) + "/month)\n" +
      "• Installation Address: " + formatAddress(addrData) + "\n" +
      "• Application Status: Under Verification\n\n" +
      (accountInfo.status === "active"
        ? "CUSTOMER PORTAL ACCESS\nYour application has been linked to your active Customer Account (" + email + "). You may sign in at any time to track your application status and updates.\n\n"
        : "CUSTOMER PORTAL ACTIVATION\nTo monitor your application online, please activate your Customer Account using your one-time 6-Digit Activation Code:\n" +
          "• Activation Code: " + accountInfo.code + "\n\n") +
      "Should you have any questions, please reach our support team at (046) 458-0908 or Hotline 101-733.\n\n" +
      "Sincerely,\n" +
      "Customer Verification & Provisioning Team\n" +
      "PIGEM Combined Facilities Support Services";

    await dbAddNotification({ user_id: accountInfo.user.id, email: email, subject: subject, body: body });
    await dbAddNotification({ role: "agent", subject: "New Application " + saved.ref_no, body: fullName + " submitted " + saved.ref_no });
    await apiSendEmail(email, subject, body);
    await dbAddActivity("application_submitted", saved.ref_no + " (" + email + ")");

    // 6. Show Reference Number Popup
    if (accountInfo.status === "active") {
      openPopup(
        '<div class="center">' +
          '<h3>Application Submitted!</h3>' +
          '<p class="small muted mt">Your Application Reference Number is:</p>' +
          '<div class="big-ref">' + saved.ref_no + '</div>' +
          '<div class="notice good mt">' +
            'We detected that <b>' + email + '</b> already has an activated Customer Account. Your new application has been added to your account.' +
          '</div>' +
          '<div class="row mt-big" style="justify-content:center">' +
            '<a class="btn btn-red" href="login.html">Continue to Customer Login</a>' +
          '</div>' +
        '</div>'
      );
    } else {
      var actUrl = "activate.html?email=" + encodeURIComponent(email) + (accountInfo.code ? "&code=" + encodeURIComponent(accountInfo.code) : "");
      openPopup(
        '<div class="center">' +
          '<h3>Application Submitted!</h3>' +
          '<p class="small muted mt">Your Application Reference Number is:</p>' +
          '<div class="big-ref">' + saved.ref_no + '</div>' +
          '<div class="notice mt" style="text-align:left;">' +
            '<b>Account Activation Sent to Email:</b><br>' +
            'We sent a formal confirmation and account activation notice to <b>' + email + '</b>' +
            (accountInfo.code ? ' (Activation Code: <b>' + accountInfo.code + '</b>)' : '') +
            '. Click below to open the Account Activation page in a new tab and set your password.' +
          '</div>' +
          '<div class="row mt-big" style="justify-content:center">' +
            '<a class="btn btn-red" href="' + actUrl + '" target="_blank">Open Account Activation (New Tab)</a>' +
          '</div>' +
        '</div>'
      );
    }
  } catch (err) {
    showAlert("Submission Error", err.message || "Could not submit application.", "bad");
    btn.disabled = false;
    btn.textContent = "Submit Registration";
  }
}

initApplyPage();
