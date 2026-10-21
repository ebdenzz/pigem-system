// ============================================================
// APPLICATION FORM SCRIPT (apply.html)
// Clean 4-Panel Flow (No "Step" Words):
//   1. Select Your Plan & Personal Information
//   2. Contact Information (with OTP) & Installation Location Map
//   3. Valid ID Documents (Front & Back) — Responsive Camera / QR Code
//   4. Subscriber Declaration & Terms
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

var SECTION_TITLES = [
  "Select Your Plan",
  "Contact Information & Location Map",
  "Valid ID Documents (Front & Back)",
  "Subscriber Declaration & Consent"
];

// Inline Tooltip Bubble for Asterisk (*) — No underlines, smooth hover
function showReqTip(el, fieldName, detail) {
  hideReqTip(el);
  var bubble = document.createElement("span");
  bubble.className = "req-bubble";
  bubble.innerHTML = "<b style='color:#fff;display:block;margin-bottom:2px;'>" + fieldName + " (Required)</b>" + detail;
  el.appendChild(bubble);
}

function hideReqTip(el) {
  if (!el) return;
  var old = el.querySelector(".req-bubble:not(.error-pop)");
  if (old) old.remove();
}

function flashErrorBubble(fieldId, fieldName, message) {
  var asterisk = document.querySelector('.req[data-req-for="' + fieldId + '"]');
  if (!asterisk) return;

  var old = asterisk.querySelectorAll(".req-bubble");
  for (var i = 0; i < old.length; i++) old[i].remove();

  var bubble = document.createElement("span");
  bubble.className = "req-bubble error-pop";
  bubble.innerHTML = "<b style='color:#fff;display:block;margin-bottom:2px;'>" + fieldName + " Required</b>" + message;
  asterisk.appendChild(bubble);

  setTimeout(function () {
    if (bubble && bubble.parentNode) bubble.remove();
  }, 4500);
}

// Device detection for camera vs desktop QR code
function setupDeviceUploadUI() {
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768);
  var camBtns = document.querySelectorAll(".phone-only-btn");
  var qrBtn = document.getElementById("btn-phone-qr");

  if (!isMobile) {
    // Desktop: hide camera buttons, show QR Code button
    for (var i = 0; i < camBtns.length; i++) {
      camBtns[i].style.display = "none";
    }
    if (qrBtn) qrBtn.style.display = "inline-flex";
  } else {
    // Phone: show camera buttons, hide QR Code button
    for (var j = 0; j < camBtns.length; j++) {
      camBtns[j].style.display = "inline-flex";
    }
    if (qrBtn) qrBtn.style.display = "none";
  }
}

// Read ?plan= and ?agent= from URL
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
  setupDeviceUploadUI();
  window.addEventListener("resize", setupDeviceUploadUI);
  showCaptchaPopup();
}

// Render Red Fiber plans
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
// Popup 1: Clean Captcha Box Only
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
    '<p class="small muted mt">Before starting your application, please prepare the following:</p>' +
    '<ul style="margin:12px 0 0 18px; font-size:15px; line-height:1.7;">' +
      '<li><b>1 Valid Government-Issued ID (Front &amp; Back):</b> PhilSys National ID, Driver\'s License, Passport, UMID, SSS, PRC, Postal, or Voter\'s ID.</li>' +
      '<li><b>Active Gmail &amp; Mobile Number:</b> You will verify your contact details with a 6-digit OTP and receive your reference number.</li>' +
      '<li><b>Exact Installation Location:</b> Pin your house or building on the interactive map so fiber facility availability can be confirmed.</li>' +
    '</ul>' +
    '<div class="row mt-big" style="justify-content:flex-end">' +
      '<button type="button" class="btn btn-red" onclick="closePopup()">OK</button>' +
    '</div>'
  );
}

// QR Code Modal for Continuing on Phone
function openPhoneQrModal() {
  var currentUrl = window.location.href;
  var qrImgUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(currentUrl);

  openPopup(
    '<div class="center">' +
      '<h3>Continue on Phone</h3>' +
      '<p class="small muted mt">Scan this QR code with your phone camera to open this application form directly on your phone and take photos of your Valid ID.</p>' +
      '<div class="mt-big" style="background:#fff; padding:16px; border-radius:12px; display:inline-block; border:1px solid var(--line);">' +
        '<img src="' + qrImgUrl + '" alt="Scan with Phone" style="width:180px; height:180px; display:block;" />' +
      '</div>' +
      '<div class="small muted mt-big">Or open this link on your mobile browser:</div>' +
      '<input type="text" readonly value="' + currentUrl + '" style="font-size:12px; text-align:center; margin-top:6px;" onclick="this.select()" />' +
      '<div class="row mt-big" style="justify-content:center">' +
        '<button type="button" class="btn btn-red" onclick="closePopup()">OK, Got It</button>' +
      '</div>' +
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
    flashErrorBubble("email", "Email Address", "Please enter a valid Gmail address first.");
    document.getElementById("email").focus();
    return;
  }
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    flashErrorBubble("phone", "Mobile Number", "Please enter an 11-digit mobile number first.");
    document.getElementById("phone").focus();
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
    "Please enter this code on the Application Form to verify your email address (" + email + ") and mobile number (" + phone + ").\n\n" +
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
    flashErrorBubble("contact_otp", "Contact OTP", "Click 'Send OTP' first to generate your code.");
    return;
  }
  if (entered !== generatedContactOtp) {
    flashErrorBubble("contact_otp", "Contact OTP", "Incorrect 6-digit OTP code.");
    return;
  }
  isContactOtpVerified = true;
  verifiedEmailAddress = document.getElementById("email").value.trim().toLowerCase();
  var badge = document.getElementById("otp-badge");
  if (badge) {
    badge.hidden = false;
    badge.className = "badge status-approved";
    badge.textContent = "✓ Verified";
  }
  var statusText = document.getElementById("otp-status-text");
  if (statusText) {
    statusText.innerHTML = "<span style='color:var(--good);font-weight:700;'>✓ Email and Mobile Number successfully verified.</span>";
  }
}

// Smart ID Format Hint
function updateIdFormatHint() {
  var type = document.getElementById("id_type").value;
  var hintEl = document.getElementById("id-format-hint");
  if (!hintEl) return;

  var hints = {
    "Philippine National ID (PhilSys)": "Format: 16 digits (e.g. 1234-5678-9012-3456)",
    "Driver's License": "Format: 1 letter + 10 digits (e.g. N01-23-456789)",
    "Passport": "Format: 9 alphanumeric characters (e.g. P1234567A)",
    "UMID": "Format: 12 digits (e.g. 0012-3456789-0)",
    "SSS ID": "Format: 10 digits (e.g. 34-1234567-8)",
    "PRC ID": "Format: 7 digits registration number",
    "Postal ID": "Format: 12-digit PRN code",
    "Voter's ID": "Format: 16-character alphanumeric code"
  };
  hintEl.textContent = hints[type] || "";
}

// Handle Valid ID File Selection (Front and Back)
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

// Step Navigation
function showPanel(index) {
  currentPanel = index;
  for (var i = 0; i < TOTAL_PANELS; i++) {
    var el = document.getElementById("panel-" + i);
    if (el) el.hidden = (i !== index);
  }
  var loadingPanel = document.getElementById("panel-loading");
  if (loadingPanel) loadingPanel.hidden = true;

  var pct = Math.round(((index + 1) / TOTAL_PANELS) * 100);
  document.getElementById("section-title").textContent = SECTION_TITLES[index];
  document.getElementById("section-pct").textContent = pct + "%";
  document.getElementById("section-bar").style.width = pct + "%";

  if (index === 1) {
    setTimeout(initMapPin, 180);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Validate Current Panel — Triggers Bubbles on Missing Fields (No Modal Alert)
function validateCurrentPanel() {
  var firstInvalidEl = null;

  function markInvalid(fieldId, name, msg, elToFocus) {
    flashErrorBubble(fieldId, name, msg);
    if (!firstInvalidEl) {
      firstInvalidEl = elToFocus || document.getElementById(fieldId);
    }
  }

  // Panel 0: Plan Selection & Personal Information
  if (currentPanel === 0) {
    var first = document.getElementById("first_name").value.trim();
    var middle = document.getElementById("middle_name").value.trim();
    var last = document.getElementById("last_name").value.trim();
    var birth = document.getElementById("birth_date").value;

    if (!first) markInvalid("first_name", "First Name", "Please enter your first name.");
    // N/A is explicitly accepted for Middle Name
    if (!middle) markInvalid("middle_name", "Middle Name", "Please enter middle name or N/A.");
    if (!last) markInvalid("last_name", "Last Name", "Please enter your last name.");
    if (!birth) markInvalid("birth_date", "Birth Date", "Please select your birth date.");

    if (firstInvalidEl) {
      firstInvalidEl.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalidEl.focus();
      return false;
    }
    return true;
  }

  // Panel 1: Contact Information (with OTP) & Location Map
  if (currentPanel === 1) {
    var email = document.getElementById("email").value.trim().toLowerCase();
    var phone = document.getElementById("phone").value.trim();
    var house = document.getElementById("house_no").value.trim();
    var bldg = document.getElementById("building_name").value.trim();
    var street = document.getElementById("street").value.trim();
    var subd = document.getElementById("subdivision").value.trim();
    var brgy = document.getElementById("barangay").value.trim();
    var city = document.getElementById("city").value.trim();
    var prov = document.getElementById("province").value.trim();
    var landmark = document.getElementById("landmark").value.trim();

    if (!email || email.indexOf("@") === -1) markInvalid("email", "Email Address", "Enter a valid Gmail address.");
    if (!phone || phone.replace(/\D/g, "").length < 10) markInvalid("phone", "Mobile Number", "Enter an 11-digit mobile number.");
    if (!isContactOtpVerified || verifiedEmailAddress !== email) {
      markInvalid("contact_otp", "Contact OTP", "Please send and verify your 6-digit OTP code.", document.getElementById("btn-send-otp"));
    }
    if (!house) markInvalid("house_no", "House No.", "Enter house, block, or lot number.");
    if (!bldg) markInvalid("building_name", "Building Name", "Enter building name or N/A.");
    if (!street) markInvalid("street", "Street Name", "Enter your street name.");
    if (!subd) markInvalid("subdivision", "Subdivision", "Enter subdivision or N/A.");
    if (!brgy) markInvalid("barangay", "Barangay", "Enter barangay name.");
    if (!city) markInvalid("city", "City", "Enter city or municipality.");
    if (!prov) markInvalid("province", "Province", "Enter province or district.");
    if (!landmark) markInvalid("landmark", "Landmark", "Enter a nearby landmark.");

    if (firstInvalidEl) {
      firstInvalidEl.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalidEl.focus();
      return false;
    }
    return true;
  }

  // Panel 2: Valid ID Documents (Front & Back)
  if (currentPanel === 2) {
    var idType = document.getElementById("id_type").value;
    var idNumber = document.getElementById("id_number").value.trim();

    if (!idType) markInvalid("id_type", "Valid ID Type", "Select your government ID type.");
    if (!idNumber) markInvalid("id_number", "ID Number", "Enter the number on your ID card.");
    if (!selectedFrontFile) markInvalid("id_front", "Front of Valid ID", "Upload photo of the FRONT of your ID.");
    if (!selectedBackFile) markInvalid("id_back", "Back of Valid ID", "Upload photo of the BACK of your ID.");

    if (firstInvalidEl) {
      firstInvalidEl.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalidEl.focus();
      return false;
    }
    return true;
  }

  // Panel 3: Subscriber Certificate & Terms
  if (currentPanel === 3) {
    if (!document.getElementById("agree_sub").checked) {
      markInvalid("agree_sub", "Terms Agreement", "Please check to accept the Subscriber Certificate.");
      if (firstInvalidEl) {
        firstInvalidEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }
    return true;
  }

  return true;
}

function nextPanel() {
  if (!validateCurrentPanel()) return;
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
// Interactive Map Pinning & Address Auto-Fill
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

    var road = addr.road || addr.pedestrian || addr.footway || addr.street || "";
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
  } catch (e) {
    statusEl.textContent = "Location pinned (" + lat.toFixed(5) + ", " + lng.toFixed(5) + "). You can type or edit your address fields below.";
  }
}

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
      statusEl.textContent = "Place not found. Please drag the pin manually or type your address below.";
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

function useCurrentLocation() {
  initMapPin();
  var statusEl = document.getElementById("map-status");
  var btn = document.getElementById("btn-use-loc");

  if (!navigator.geolocation) {
    statusEl.textContent = "Browser does not support automatic location detection. Please search or drag the pin.";
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Locating...";
  }
  if (statusEl) statusEl.textContent = "Detecting current GPS location...";

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
    navigator.geolocation.getCurrentPosition(
      onGeoSuccess,
      function (err) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = "&#128205; Use My Location";
        }
        var msg = "Location permission denied or unavailable. Please search your street/barangay in the box above.";
        if (statusEl) statusEl.textContent = msg;
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

// ============================================================
// Realistic Loading Animation Screen & Submission
// ============================================================
function advanceLoadingStep(stepNum) {
  for (var i = 1; i <= 4; i++) {
    var el = document.getElementById("step-ld-" + i);
    if (!el) continue;
    if (i < stepNum) {
      el.className = "reg-step-item done";
      el.querySelector(".reg-step-icon").innerHTML = "&#10003;";
    } else if (i === stepNum) {
      el.className = "reg-step-item active";
      el.querySelector(".reg-step-icon").textContent = String(i);
    } else {
      el.className = "reg-step-item";
      el.querySelector(".reg-step-icon").textContent = String(i);
    }
  }
}

async function submitRegistration() {
  if (!validateCurrentPanel()) return;

  var first = document.getElementById("first_name").value.trim();
  var middle = document.getElementById("middle_name").value.trim();
  var last = document.getElementById("last_name").value.trim();
  var fullName = [first, (middle.toUpperCase() === "N/A" ? "" : middle), last].filter(Boolean).join(" ");
  var email = document.getElementById("email").value.trim().toLowerCase();
  var birth = document.getElementById("birth_date").value;
  var idType = document.getElementById("id_type").value;
  var idNumber = document.getElementById("id_number").value.trim();
  var p = getPlanById(selectedPlanId);

  // Switch to realistic loading screen
  for (var i = 0; i < TOTAL_PANELS; i++) {
    var pEl = document.getElementById("panel-" + i);
    if (pEl) pEl.hidden = true;
  }
  var loadingScreen = document.getElementById("panel-loading");
  if (loadingScreen) loadingScreen.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });

  try {
    // Step 1: Verification
    advanceLoadingStep(1);
    await new Promise(function (r) { setTimeout(r, 650); });

    // Step 2: Upload Valid ID Front and Back (saved to Supabase customer-documents)
    advanceLoadingStep(2);
    var accountInfo = await dbCreateAccountFromApplication(fullName, email);
    var frontPath = await dbUploadDocument(selectedFrontFile, accountInfo.user.id || "public", "id-front");
    var backPath = await dbUploadDocument(selectedBackFile, accountInfo.user.id || "public", "id-back");

    // Local AI Screening check (falls back smoothly if offline)
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
        ai: { model: "disabled", summary: "AI screening is currently offline.", correction_message: "" }
      };
    }

    // Step 3: Registering Application & Account
    advanceLoadingStep(3);
    await new Promise(function (r) { setTimeout(r, 650); });

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

    // Save application with correct column names (id_front_path and id_back_path)
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
      id_back_path: backPath,
      remarks: document.getElementById("remarks").value.trim(),
      agree_tu: document.getElementById("agree_tu").checked,
      screening: screening
    }));

    // Step 4: Generating Reference Number
    advanceLoadingStep(4);
    await new Promise(function (r) { setTimeout(r, 700); });

    // Send Professional Business Email & Notification
    var subject = "PIGEM Application Confirmation — Reference No. " + saved.ref_no;
    var body =
      "Dear " + fullName + ",\n\n" +
      "Thank you for submitting your internet service application with PIGEM Combined Facilities Support Services.\n\n" +
      "APPLICATION DETAILS\n" +
      "• Reference Number: " + saved.ref_no + "\n" +
      "• Plan: Red Fiber " + p.name + " (" + p.speed + " Mbps — " + formatPeso(p.price) + "/mo)\n" +
      "• Installation Address: " + formatAddress(addrData) + "\n" +
      "• Status: Under Verification\n\n" +
      (accountInfo.status === "active"
        ? "CUSTOMER ACCOUNT\nYour application has been added to your existing account (" + email + "). You may log in anytime to monitor progress.\n\n"
        : "ACCOUNT ACTIVATION\nTo monitor your application online, activate your Customer Account using your one-time activation code:\n" +
          "• Activation Code: " + accountInfo.code + "\n\n") +
      "Sincerely,\n" +
      "PIGEM Combined Facilities Support Services";

    await dbAddNotification({ user_id: accountInfo.user.id, email: email, subject: subject, body: body });
    await dbAddNotification({ role: "agent", subject: "New Application " + saved.ref_no, body: fullName + " submitted " + saved.ref_no });
    await apiSendEmail(email, subject, body);
    await dbAddActivity("application_submitted", saved.ref_no + " (" + email + ")");

    // Complete all step icons
    for (var k = 1; k <= 4; k++) {
      var item = document.getElementById("step-ld-" + k);
      if (item) {
        item.className = "reg-step-item done";
        item.querySelector(".reg-step-icon").innerHTML = "&#10003;";
      }
    }

    // Show Reference Number Popup
    if (accountInfo.status === "active") {
      openPopup(
        '<div class="center">' +
          '<h3>Application Submitted!</h3>' +
          '<p class="small muted mt">Your Application Reference Number is:</p>' +
          '<div class="big-ref">' + saved.ref_no + '</div>' +
          '<div class="notice good mt">' +
            'Your application has been submitted and added to your existing Customer Account.' +
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
            '<b>Account Activation Notice:</b><br>' +
            'We sent an activation notice to <b>' + email + '</b>' +
            (accountInfo.code ? ' (Activation Code: <b>' + accountInfo.code + '</b>)' : '') +
            '. Click below to open the Account Activation page and create your password.' +
          '</div>' +
          '<div class="row mt-big" style="justify-content:center">' +
            '<a class="btn btn-red" href="' + actUrl + '" target="_blank">Open Account Activation</a>' +
          '</div>' +
        '</div>'
      );
    }
  } catch (err) {
    if (loadingScreen) loadingScreen.hidden = true;
    showPanel(3);
    showAlert("Submission Error", err.message || "Could not submit application.", "bad");
  }
}

initApplyPage();
