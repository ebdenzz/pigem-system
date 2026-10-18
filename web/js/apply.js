// ============================================================
// APPLICATION FORM SCRIPT (Red Fiber Fields, Popups, Grab Map, ID Checks)
// ============================================================

var TOTAL_PANELS = 5;
var currentPanel = 0;
var selectedPlanId = "1400";
var referralAgentId = null;
var leafletMap = null;
var leafletMarker = null;

// Show a small help popup when the user clicks a red * on any field
function helpTip(fieldName, message) {
  showAlert(fieldName, message, "");
}

// 1. Popup #1 when the Application Form opens: CAPTCHA Security Check
function showCaptchaPopup() {
  openPopup(
    '<h3>Security Check</h3>' +
    '<p class="small muted mt">Please confirm you are not a robot before filling out the application form.</p>' +
    '<div id="popup-recaptcha" class="mt"></div>' +
    '<label class="check mt">' +
      '<input type="checkbox" id="popup-captcha-check">' +
      '<span>I am not a robot</span>' +
    '</label>' +
    '<div class="row mt-big" style="justify-content:flex-end">' +
      '<button type="button" class="btn btn-red" onclick="confirmCaptchaPopup()">Continue</button>' +
    '</div>'
  );

  // Render Google reCAPTCHA inside the popup if online
  setTimeout(function () {
    var box = document.getElementById("popup-recaptcha");
    if (box && window.grecaptcha && window.grecaptcha.render) {
      try {
        window.grecaptcha.render("popup-recaptcha", {
          sitekey: CONFIG.RECAPTCHA_SITE_KEY,
          callback: function () {
            var chk = document.getElementById("popup-captcha-check");
            if (chk) chk.checked = true;
          }
        });
      } catch (e) {}
    }
  }, 300);
}

function confirmCaptchaPopup() {
  var chk = document.getElementById("popup-captcha-check");
  if (!chk || !chk.checked) {
    alert("Please check 'I am not a robot' to continue.");
    return;
  }
  showInstructionPopup();
}

// 2. Popup #2 after CAPTCHA: Application Form Instructions
function showInstructionPopup() {
  openPopup(
    '<h3>Application Form Instructions</h3>' +
    '<div class="notice mt">' +
      '<ul style="margin:4px 0; padding-left:18px;">' +
        '<li>Applicant must be at least 18 years old.</li>' +
        '<li>Enter your name, birth date, and ID number exactly as shown on your Primary Valid ID.</li>' +
        '<li>Click any red <b>*</b> if you need help on what to enter in a field.</li>' +
        '<li>Pin your installation address on the map to auto-fill your location details.</li>' +
      '</ul>' +
    '</div>' +
    '<div class="row mt-big" style="justify-content:flex-end">' +
      '<button type="button" class="btn btn-red" onclick="closePopup()">Start Application</button>' +
    '</div>'
  );
}

// Initialize the Application Form
async function initApplyPage() {
  var params = new URLSearchParams(window.location.search);
  if (params.get("plan")) {
    selectedPlanId = params.get("plan");
  }
  if (params.get("agent")) {
    referralAgentId = params.get("agent");
  }

  // Render Plan choices
  renderPlanPicker();

  // Populate Primary ID Types (all 25 Red Fiber ID types)
  var idSelect = document.getElementById("id_type");
  var idHtml = '<option value="">Select Primary I.D Type</option>';
  for (var i = 0; i < CONFIG.ID_TYPES.length; i++) {
    idHtml += '<option value="' + CONFIG.ID_TYPES[i].name + '">' + CONFIG.ID_TYPES[i].name + '</option>';
  }
  idSelect.innerHTML = idHtml;

  // Populate Unit Types
  var unitSelect = document.getElementById("unit_type");
  var unitHtml = '<option value="">Unit Type</option>';
  for (var u = 0; u < CONFIG.UNIT_TYPES.length; u++) {
    unitHtml += '<option value="' + CONFIG.UNIT_TYPES[u] + '">' + CONFIG.UNIT_TYPES[u] + '</option>';
  }
  unitSelect.innerHTML = unitHtml;

  // Default map coordinates
  document.getElementById("lat").value = CONFIG.MAP_CENTER[0];
  document.getElementById("lng").value = CONFIG.MAP_CENTER[1];

  // Pre-fill email and name if customer is already signed in
  var user = await dbGetCurrentUser();
  if (user && user.role === "customer") {
    document.getElementById("email").value = user.email || "";
    var parts = String(user.full_name || "").split(" ");
    if (parts.length > 0) document.getElementById("first_name").value = parts[0];
    if (parts.length > 1) document.getElementById("last_name").value = parts.slice(1).join(" ");
  }

  // Press Enter to move to next panel (without interfering with Space bar or textareas)
  document.getElementById("apply-form").addEventListener("keydown", function (event) {
    if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
      event.preventDefault();
      if (event.target.id === "map-search") {
        searchMapAddress();
      } else if (currentPanel < TOTAL_PANELS - 1) {
        nextPanel();
      }
    }
  });

  showPanel(0);
  showCaptchaPopup();
}

// Render Plan Picker and Red Fiber Plan Summary Card
function renderPlanPicker() {
  var plans = getActivePlans();
  var box = document.getElementById("plan-picker");
  var html = "";
  for (var i = 0; i < plans.length; i++) {
    var p = plans[i];
    var isPicked = String(p.id) === String(selectedPlanId);
    html +=
      '<label class="' + (isPicked ? "picked" : "") + '" onclick="selectPlan(\'' + p.id + '\')">' +
        '<input type="radio" name="plan_radio" value="' + p.id + '" ' + (isPicked ? "checked" : "") + '>' +
        '<b>Red Fiber ' + p.name + '</b>' +
        '<span class="small muted">' + p.speed + ' Mbps · ' + formatPeso(p.price) + '/mo</span>' +
      '</label>';
  }
  box.innerHTML = html;

  var chosen = getPlanById(selectedPlanId);
  document.getElementById("selected-plan-card").innerHTML =
    '<div class="row between">' +
      '<div>' +
        '<span class="tag">Red Fiber ' + chosen.name + ' — ' + chosen.speed + ' Mbps</span>' +
        '<div class="speed">' + chosen.speed + ' <span>Mbps</span></div>' +
        '<h3 class="mt">Red Fiber ' + chosen.name + '</h3>' +
        '<p class="muted small mt">Unlimited with Pure fiber internet.</p>' +
      '</div>' +
      '<div class="price">' + formatPeso(chosen.price) + ' <span>/ month</span></div>' +
    '</div>' +
    '<hr style="margin:14px 0; border:0; border-top:1px solid var(--line);">' +
    '<b>Inclusions</b>' +
    '<ul style="margin:8px 0 0; padding-left:18px;" class="small muted">' +
      '<li>No Lock-in</li>' +
      '<li>Zero Modem Fee</li>' +
      '<li>50% discount on Php 2,000 one-time installation fee</li>' +
    '</ul>';
}

function selectPlan(planId) {
  selectedPlanId = String(planId);
  renderPlanPicker();
}

// Update the format hint when Primary ID Type changes
function updateIdHint() {
  var typeName = document.getElementById("id_type").value;
  var hintBox = document.getElementById("id-hint");
  if (!typeName) {
    hintBox.textContent = "";
    return;
  }
  var info = getIdType(typeName);
  hintBox.textContent = "Format guide: " + info.hint;
}

// Show preview of uploaded ID front photo
function previewIdPhoto() {
  var file = document.getElementById("id_front").files[0];
  var img = document.getElementById("preview_front");
  if (!file) {
    img.hidden = true;
    return;
  }
  img.src = URL.createObjectURL(file);
  img.hidden = false;
}

// Show a panel (0 to 4) and update the top progress bar
function showPanel(index) {
  currentPanel = index;
  var pct = Math.round(((currentPanel + 1) / TOTAL_PANELS) * 100);
  document.getElementById("step-bar").style.width = pct + "%";

  for (var i = 0; i < TOTAL_PANELS; i++) {
    document.getElementById("panel-" + i).hidden = (i !== currentPanel);
  }

  document.getElementById("btn-back").style.visibility = currentPanel === 0 ? "hidden" : "visible";
  document.getElementById("btn-next").hidden = (currentPanel === TOTAL_PANELS - 1);
  document.getElementById("btn-submit").hidden = (currentPanel !== TOTAL_PANELS - 1);

  if (currentPanel === 2) {
    setTimeout(initMapPin, 120);
  }
  if (currentPanel === 4) {
    buildReviewSummary();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Validate current panel fields and pop up showAlert() if anything is missing or invalid
function validateCurrentPanel() {
  if (currentPanel === 1) {
    var first = document.getElementById("first_name").value.trim();
    var last = document.getElementById("last_name").value.trim();
    var email = document.getElementById("email").value.trim();
    var birth = document.getElementById("birth_date").value;
    var idType = document.getElementById("id_type").value;
    var idNum = document.getElementById("id_number").value.trim();
    var idFile = document.getElementById("id_front").files[0];

    if (!first) return "Please enter your First Name.";
    if (!last) return "Please enter your Last Name.";
    if (!email || email.indexOf("@") === -1) return "Please enter a valid Email Address.";
    if (!birth) return "Please select your Birth Date.";

    var age = (Date.now() - new Date(birth).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 18) return "Applicant must be at least 18 years old.";

    if (!idType) return "Please select your Primary I.D Type.";
    if (!idNum) return "Please enter your Primary I.D Number.";

    // Check ID number length/format for the chosen ID type
    var idRule = getIdType(idType);
    var cleanedId = idNum.replace(/[\s\-]/g, "").toUpperCase();
    if (idRule.pattern && !idRule.pattern.test(cleanedId)) {
      return "Invalid ID Number for " + idType + ". " + idRule.hint;
    }

    if (!idFile) return "Please upload a clear front photo of your Primary I.D.";
    if (idFile.size > 4 * 1024 * 1024) return "Uploaded ID photo must be 4 MB or smaller.";
  }

  if (currentPanel === 2) {
    var phone = document.getElementById("phone").value.trim();
    if (!/^(\+?63|0)9\d{9}$/.test(phone.replace(/[\s\-]/g, ""))) {
      return "Please enter a valid Primary Mobile Number (example: 09171234567).";
    }
    if (!document.getElementById("building_name").value.trim()) return "Please enter Building / Apartment Name (or N/A).";
    if (!document.getElementById("street").value.trim()) return "Please enter your Street Name.";
    if (!document.getElementById("subdivision").value.trim()) return "Please enter your Subdivision/Village (or N/A).";
    if (!document.getElementById("barangay").value.trim()) return "Please enter your Barangay.";
    if (!document.getElementById("city").value.trim()) return "Please enter your City/Municipality.";
    if (!document.getElementById("province").value.trim()) return "Please enter your District/Province.";
    if (!document.getElementById("landmark").value.trim()) return "Please enter the Nearest Landmark.";
  }

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
// ============================================================

// MAJOR: Initialize Leaflet + OpenStreetMap and auto-fill address when pin moves
function initMapPin() {
  if (!leafletMap) {
    var lat = parseFloat(document.getElementById("lat").value) || CONFIG.MAP_CENTER[0];
    var lng = parseFloat(document.getElementById("lng").value) || CONFIG.MAP_CENTER[1];

    leafletMap = L.map("map").setView([lat, lng], 15);
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
  } else {
    leafletMap.invalidateSize();
  }
}

// Reverse-geocode the pinned coordinates using OpenStreetMap Nominatim and fill address fields
async function updatePinAndAddress(lat, lng) {
  document.getElementById("lat").value = lat.toFixed(6);
  document.getElementById("lng").value = lng.toFixed(6);
  var statusEl = document.getElementById("map-status");
  statusEl.textContent = "Looking up address for pinned location...";

  try {
    var url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + lat + "&lon=" + lng;
    var res = await fetch(url);
    var data = await res.json();
    var addr = data.address || {};

    var road = addr.road || addr.pedestrian || addr.Footway || "";
    var subd = addr.neighbourhood || addr.residential || addr.hamlet || "";
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

    // Check if pinned address is within Red Fiber service areas
    var combined = (city + " " + prov + " " + (data.display_name || "")).toLowerCase();
    if (!isServiceArea(combined)) {
      showAlert(
        "Service Availability Notice",
        "Your pinned location (" + (city || prov || "selected area") + ") appears to be outside our standard service areas (Metro Manila, Bulacan, Cavite, Laguna, Rizal, and Cebu). You may still continue your application and our team will validate availability.",
        "warn"
      );
    }
  } catch (e) {
    statusEl.textContent = "Location pinned. You can type or edit your address fields below.";
  }
}

// Search an address and move the map pin there
async function searchMapAddress() {
  var q = document.getElementById("map-search").value.trim();
  if (!q) return;
  var statusEl = document.getElementById("map-status");
  statusEl.textContent = "Searching map for '" + q + "'...";

  try {
    var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&q=" + encodeURIComponent(q);
    var res = await fetch(url);
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

// Use browser GPS location
function useCurrentLocation() {
  if (!navigator.geolocation) {
    showAlert("Location Unavailable", "Your browser does not support automatic location detection.", "warn");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      if (leafletMap && leafletMarker) {
        leafletMap.setView([lat, lng], 16);
        leafletMarker.setLatLng([lat, lng]);
      }
      updatePinAndAddress(lat, lng);
    },
    function () {
      showAlert("Location Permission", "Unable to read your current location. Please click on the map to pin your address.", "warn");
    }
  );
}

// Build the Review Summary on Panel 4
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

  var idFile = document.getElementById("id_front").files[0];

  var rows = [
    ["Selected Plan", "Red Fiber " + p.name + " — " + p.speed + " Mbps (" + formatPeso(p.price) + "/mo)"],
    ["Applicant Name", fullName],
    ["Email Address", document.getElementById("email").value.trim()],
    ["Birth Date", document.getElementById("birth_date").value],
    ["Primary Valid ID", document.getElementById("id_type").value + " — " + document.getElementById("id_number").value.trim()],
    ["Uploaded ID Photo", idFile ? idFile.name : "-"],
    ["Primary Mobile Number", document.getElementById("phone").value.trim()],
    ["Secondary Mobile Number", document.getElementById("phone_alt").value.trim() || "-"],
    ["Installation Address", formatAddress(addrObj)],
    ["Nearest Landmark", document.getElementById("landmark").value.trim()],
    ["Remarks / Instructions", document.getElementById("remarks").value.trim() || "-"]
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
    var idFile = document.getElementById("id_front").files[0];

    // 1. Check / create Customer account for this email
    var accountInfo = await dbCreateAccountFromApplication(fullName, email);

    // 2. Upload Valid ID Front photo
    var frontPath = await dbUploadDocument(idFile, accountInfo.user.id || "public", "id-front");

    // 3. Run AI-Assisted Screening if enabled by Admin
    var screening = null;
    if (getSystemSettings().ai_enabled) {
      screening = await apiRunScreening(idFile, {
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
      remarks: document.getElementById("remarks").value.trim(),
      agree_tu: document.getElementById("agree_tu").checked,
      screening: screening
    }));

    // 5. Send Email & Notification
    var subject = "Application Reference " + saved.ref_no;
    var body =
      "Hello " + fullName + ", your internet service application reference number is " + saved.ref_no + ". " +
      (accountInfo.status === "active"
        ? "Log in to your Customer Account to monitor your application status."
        : "Your one-time Account Activation Code is: " + accountInfo.code);

    await dbAddNotification({ user_id: accountInfo.user.id, email: email, subject: subject, body: body });
    await dbAddNotification({ role: "agent", subject: "New Application " + saved.ref_no, body: fullName + " submitted " + saved.ref_no });
    await apiSendEmail(email, subject, body);
    await dbAddActivity("application_submitted", saved.ref_no + " (" + email + ")");

    // 6. Show Reference Number Popup (detects if account is already activated vs new customer)
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
            'We sent an account activation message to <b>' + email + '</b>' +
            (accountInfo.code ? ' (Demo OTP Code: <b>' + accountInfo.code + '</b>)' : '') +
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
