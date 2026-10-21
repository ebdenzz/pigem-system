// ============================================================
// PIGEM SETTINGS AND SHARED HELPERS (used by every page)
// ============================================================

// Pages inside /staff and /admin set ROOT = "../" so pictures and links still work
var ROOT = window.ROOT || "";

var CONFIG = {
  // MAJOR: Paste your Supabase Project URL and anon key here. Leave "" to use Demo Mode (browser storage).
  SUPABASE_URL: "https://wuunqfxyejxwrawtjdrf.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dW5xZnh5ZWp4d3Jhd3RqZHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNTE3MTEsImV4cCI6MjEwNzcyNzcxMX0.4Wt-6pJpLS4OUf_93bFn1513omGESvMn_E0ulnONf2g",

  // MAJOR: Python FastAPI server (OpenCV, PaddleOCR, Ollama, Resend)
  API_URL: "http://127.0.0.1:8001",

  // MAJOR: Where website pictures come from: "supabase" (website-assets bucket), "server" (FastAPI), or "local"
  ASSET_SOURCE: "supabase",

  // Google reCAPTCHA v2 test key (replace with your own key when the site has a real domain)
  RECAPTCHA_SITE_KEY: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",

  // Red Fiber plans (the Manager can edit these in Content > Plans)
  PLANS: [
    { id: "1000", name: "Plan 1000", speed: 100, price: 1000, tag: "Fiber for your home", featured: false },
    { id: "1400", name: "Plan 1400", speed: 300, price: 1400, tag: "Most chosen", featured: true },
    { id: "1900", name: "Plan 1900", speed: 500, price: 1900, tag: "Fiber for your home", featured: false }
  ],

  // Inclusions shown on every plan card
  PLAN_INCLUSIONS: [
    "Unlimited pure fiber internet",
    "No lock-in",
    "Zero modem fee",
    "50% discount on the ₱2,000 one-time installation fee"
  ],

  // Application statuses in order
  STATUSES: ["Processing", "Needs Correction", "Ready for Encoding", "Provider Processing", "Approved", "Rejected"],

  // Map starting point (Dasmariñas City, Cavite)
  MAP_CENTER: [14.3294, 120.9367],

  // Service areas. If the pinned address does not contain one of these, the customer gets a warning.
  SERVICE_AREAS: [
    "metro manila", "ncr", "national capital region", "manila", "quezon city", "makati", "pasig", "taguig",
    "caloocan", "pasay", "paranaque", "parañaque", "las pinas", "las piñas", "muntinlupa", "marikina",
    "mandaluyong", "san juan", "valenzuela", "malabon", "navotas", "pateros",
    "bulacan", "cavite", "laguna", "rizal", "cebu"
  ],

  UNIT_TYPES: ["House", "Townhouse", "Apartment", "Condominium", "Dormitory", "Commercial"],

  // Valid ID types (same list as the Red Fiber form).
  // "pattern" is a basic check of the ID number AFTER removing spaces and dashes. "hint" is shown to the customer.
  ID_TYPES: [
    { name: "National ID", hint: "PhilSys Card Number: 16 digits (1234-5678-9012-3456) or PSN: 12 digits.", pattern: /^(\d{12}|\d{16})$/ },
    { name: "Philippine Passport", hint: "1-2 letters, 7 digits, optional letter at the end (P1234567A).", pattern: /^[A-Z]{1,2}\d{7}[A-Z]?$/ },
    { name: "Philippine Driver's License", hint: "1 letter + 10 digits (N01-23-456789).", pattern: /^[A-Z]\d{10}$/ },
    { name: "SSS/GSIS with photo", hint: "SSS: 10 digits (34-1234567-8). GSIS: 11 digits.", pattern: /^\d{10,11}$/ },
    { name: "Unified Multi-Purpose ID", hint: "CRN: 12 digits (0111-2345678-9).", pattern: /^\d{12}$/ },
    { name: "My.SSS ID", hint: "SSS number: 10 digits.", pattern: /^\d{10}$/ },
    { name: "PRC/IBP/OFW/Diplomat ID", hint: "PRC: 7 digits. Other IDs: type the number exactly as printed.", pattern: /^[A-Z0-9]{5,15}$/ },
    { name: "Digitized PhilHealth ID", hint: "12 digits (12-345678901-2).", pattern: /^\d{12}$/ },
    { name: "Laminated PhilHealth ID", hint: "12 digits (12-345678901-2).", pattern: /^\d{12}$/ },
    { name: "Digitized Postal ID", hint: "PRN: 12 to 13 characters as printed.", pattern: /^[A-Z0-9]{12,13}$/ },
    { name: "Laminated Postal ID", hint: "Type the number exactly as printed.", pattern: /^[A-Z0-9]{6,15}$/ },
    { name: "Digitized Voter's/Comelec ID", hint: "VIN: letters and digits as printed (around 22 characters).", pattern: /^[A-Z0-9]{15,28}$/ },
    { name: "Voter's ID", hint: "VIN: letters and digits as printed.", pattern: /^[A-Z0-9]{15,28}$/ },
    { name: "TIN with photo", hint: "9 to 12 digits (123-456-789-000).", pattern: /^\d{9,12}$/ },
    { name: "AFP ID", hint: "Type the number exactly as printed.", pattern: /^[A-Z0-9]{4,20}$/ },
    { name: "PNP ID", hint: "Type the number exactly as printed.", pattern: /^[A-Z0-9]{4,20}$/ },
    { name: "Philippine Air Force ID", hint: "Type the number exactly as printed.", pattern: /^[A-Z0-9]{4,20}$/ },
    { name: "Locally-issued Credit Card (photo or non-photo)", hint: "Last 4 digits of the card only.", pattern: /^\d{4}$/ },
    { name: "Company ID (Top 1000 Corporations)", hint: "Employee ID number as printed.", pattern: /^[A-Z0-9]{3,20}$/ },
    { name: "Firearms License ID (Digitized/Card Type only)", hint: "Type the number exactly as printed.", pattern: /^[A-Z0-9]{4,20}$/ },
    { name: "Alien Certificate of Registration (Permanent Status)", hint: "ACR I-Card number as printed (letter + digits).", pattern: /^[A-Z0-9]{6,15}$/ },
    { name: "Student ID (Top 228 Universities and Colleges)", hint: "Student number as printed.", pattern: /^[A-Z0-9]{4,20}$/ },
    { name: "Police Clearance (Verifiable Online)", hint: "Clearance number as printed.", pattern: /^[A-Z0-9]{6,25}$/ },
    { name: "Senior Citizen's ID", hint: "OSCA ID number as printed.", pattern: /^[A-Z0-9]{3,20}$/ },
    { name: "Barangay ID", hint: "Barangay ID number as printed.", pattern: /^[A-Z0-9]{2,20}$/ }
  ]
};

// Default public website content (the Manager can edit all of this in Content CMS)
var DEFAULT_CONTENT = {
  logo_image: "logo.png",
  hero_slides: [
    { tag: "RED FIBER POSTPAID", image: "Banners/home-banner-1.png", title: "Fiber internet for your home", text: "No lock-in. Zero modem fee. 50% off the ₱2,000 installation fee." },
    { tag: "SIMPLENG WIFI", image: "Banners/home-banner-2.png", title: "Apply online, anytime", text: "Send your application and valid ID from your phone or computer." },
    { tag: "LOCAL SUPPORT", image: "Banners/home-banner-3.png", title: "Your local team in Dasmariñas, Cavite", text: "Ready to help with your Red Fiber application from start to installation." },
    { tag: "PURE FIBER PLANS", image: "hero-fleet.png", title: "Fast, unlimited fiber connection", text: "Plans starting at ₱1,000/month with speeds up to 500 Mbps." }
  ],
  area_text: "Available in select Metro Manila, Bulacan, Cavite, Laguna, Rizal, and Cebu areas.",
  about_slides: [
    { tag: "ABOUT PIGEM", image: "Banners/about-banner-1.png", title: "About PIGEM", text: "Electrical and telecommunications services in Dasmariñas City, Cavite." },
    { tag: "FIELD OPERATIONS", image: "hero-fleet.png", title: "Our field team", text: "Around 40 trained installers and technicians." },
    { tag: "ESTABLISHED 2021", image: "Banners/about-banner-2.png", title: "Serving since 2021", text: "Established on December 28, 2021." },
    { tag: "TRUSTED PARTNER", image: "Banners/about-banner-3.png", title: "Complete telecommunication support", text: "Guided installation and responsive local coordination." }
  ],
  // Active strips shown on Home and About pages
  client_images: ["Clients/client-infus8.png", "Clients/client-radius.png", "Clients/client-maxcyc.png"],
  vehicle_images: [
    "Vehicles/vehicle-1.png", "Vehicles/vehicle-2.png", "Vehicles/vehicle-3.png",
    "Vehicles/vehicle-4.png", "Vehicles/vehicle-5.png", "Vehicles/vehicle-6.png"
  ],
  permit_images: [
    "Permits/permit-1.png", "Permits/permit-2.png", "Permits/permit-3.png",
    "Permits/permit-4.png", "Permits/permit-5.png", "Permits/permit-6.png",
    "Permits/permit-7.png", "Permits/permit-8.png", "Permits/permit-9.png"
  ],
  // Saved bucket image library (Manager can upload 10+ banners/assets and switch anytime)
  asset_library: {
    Banners: [
      "Banners/home-banner-1.png", "Banners/home-banner-2.png", "Banners/home-banner-3.png",
      "Banners/about-banner-1.png", "Banners/about-banner-2.png", "Banners/about-banner-3.png",
      "hero-fleet.png"
    ],
    Logos: ["logo.png"],
    Clients: ["Clients/client-infus8.png", "Clients/client-radius.png", "Clients/client-maxcyc.png"],
    Vehicles: [
      "Vehicles/vehicle-1.png", "Vehicles/vehicle-2.png", "Vehicles/vehicle-3.png",
      "Vehicles/vehicle-4.png", "Vehicles/vehicle-5.png", "Vehicles/vehicle-6.png"
    ],
    Permits: [
      "Permits/permit-1.png", "Permits/permit-2.png", "Permits/permit-3.png",
      "Permits/permit-4.png", "Permits/permit-5.png", "Permits/permit-6.png",
      "Permits/permit-7.png", "Permits/permit-8.png", "Permits/permit-9.png"
    ]
  },
  about: {
    story: "PIGEM Combined Facilities Support Services is an electrical and telecommunications services company based in Dasmariñas City, Cavite. It was established on December 28, 2021 by Mr. Mario Eusebio I. Pangilinan.",
    story2: "PIGEM started by providing temporary support for an existing telecommunications project. Since then, the team has grown from three employees to around 40 trained installers and technicians who handle internet service applications, field coordination, and installation support.",
    mission: "To help customers move through the application process with clear guidance and dependable support.",
    vision: "To become a trusted local partner for customers who need help with internet service applications.",
    values: "Responsibility, Efficiency, Commitment, Integrity, and Teamwork."
  },
  faqs: [
    { q: "Where is Red Fiber available?", a: "Red Fiber is available in select areas of Metro Manila, Bulacan, Cavite, Laguna, Rizal, and Cebu. Pin your exact location on the application form and our team will confirm if your area can be served." },
    { q: "What do I need to apply?", a: "One valid ID (front photo), your contact details, and your complete installation address." },
    { q: "Is there a lock-in period?", a: "No. All plans have no lock-in period and zero modem fee." },
    { q: "How will I know the status of my application?", a: "After you submit, you will receive a reference number and an email to activate your customer account. Log in anytime to check your status." },
    { q: "What if there is a problem with my application?", a: "We will email you and show what needs to be fixed in your account. You can update your details or upload a clearer ID there." },
    { q: "How long is installation after approval?", a: "Please allow 3 to 5 business days after approval for installation scheduling." }
  ]
};

// ============================================================
// Website pictures (Supabase Storage, Python server, or local folder)
// ============================================================

// MAJOR: Build the address of a website picture
function getImageUrl(filePath) {
  if (!filePath) return ROOT + "assets/images/placeholder.png";
  if (filePath.indexOf("data:") === 0 || filePath.indexOf("http") === 0) return filePath;
  if (CONFIG.ASSET_SOURCE === "supabase" && CONFIG.SUPABASE_URL !== "") {
    return CONFIG.SUPABASE_URL + "/storage/v1/object/public/website-assets/" + filePath;
  }
  if (CONFIG.ASSET_SOURCE === "server" && CONFIG.API_URL !== "") {
    return CONFIG.API_URL + "/assets/images/" + filePath;
  }
  return ROOT + "assets/images/" + filePath;
}

// If a picture fails to load, try the local folder, then placeholder.png
function imageFallback(img, filePath) {
  if (img.getAttribute("data-tried") !== "yes") {
    img.setAttribute("data-tried", "yes");
    img.src = ROOT + "assets/images/" + filePath;
  } else {
    img.onerror = null;
    img.src = ROOT + "assets/images/placeholder.png";
  }
}

// Load every <img data-img="..."> on the page (and apply active CMS logo)
function loadPageImages() {
  var wc = getWebsiteContent();
  var activeLogo = wc.logo_image || "logo.png";

  var images = document.querySelectorAll("img[data-img]");
  for (var i = 0; i < images.length; i++) {
    var filePath = images[i].getAttribute("data-img");
    if (filePath === "logo.png") filePath = activeLogo;
    images[i].setAttribute("onerror", "imageFallback(this, '" + filePath + "')");
    images[i].src = getImageUrl(filePath);
  }

  // Also update static brand logos if Manager switched the logo in CMS
  if (activeLogo !== "logo.png") {
    var brandImgs = document.querySelectorAll(".brand img, .logo img, .simple-bar img");
    for (var b = 0; b < brandImgs.length; b++) {
      brandImgs[b].src = getImageUrl(activeLogo);
    }
  }
}

// ============================================================
// Saved settings (Synced with Supabase + cached in localStorage)
// ============================================================

function readSaved(key, defaultValue) {
  var raw = localStorage.getItem(key);
  if (!raw) return defaultValue;
  try { return JSON.parse(raw); } catch (e) { return defaultValue; }
}

function writeSaved(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getActivePlans() { return readSaved("pigem_plans", CONFIG.PLANS); }
function saveActivePlans(plans) {
  writeSaved("pigem_plans", plans);
  if (typeof dbSaveLivePlans === "function") dbSaveLivePlans(plans);
}

function getWebsiteContent() {
  var saved = readSaved("pigem_website_content", {});
  var merged = Object.assign({}, DEFAULT_CONTENT, saved);
  merged.asset_library = Object.assign({}, DEFAULT_CONTENT.asset_library, saved.asset_library || {});
  return merged;
}
function saveWebsiteContent(content) {
  writeSaved("pigem_website_content", content);
  if (typeof dbSaveLiveWebsiteContent === "function") dbSaveLiveWebsiteContent(content);
}

function getSystemSettings() {
  return Object.assign({
    ai_enabled: true,
    maintenance_mode: false,
    maintenance_message: "The website, application form, and account activation are currently under scheduled maintenance while we update our content. Please come back shortly."
  }, readSaved("pigem_system_settings", {}));
}
function saveSystemSettings(settings) {
  writeSaved("pigem_system_settings", settings);
  if (typeof dbSaveLiveSystemSettings === "function") dbSaveLiveSystemSettings(settings);
}

// ============================================================
// Small formatting helpers
// ============================================================

function formatPeso(amount) {
  return "₱" + Number(amount).toLocaleString("en-US");
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function formatDay(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function getPlanById(planId) {
  var plans = getActivePlans();
  for (var i = 0; i < plans.length; i++) {
    if (String(plans[i].id) === String(planId)) return plans[i];
  }
  return { id: planId, name: "Plan " + planId, speed: "-", price: planId };
}

function getIdType(name) {
  for (var i = 0; i < CONFIG.ID_TYPES.length; i++) {
    if (CONFIG.ID_TYPES[i].name === name) return CONFIG.ID_TYPES[i];
  }
  return { name: name, hint: "Type the number exactly as printed.", pattern: /^[A-Z0-9]{4,25}$/ };
}

// Join the address parts of an application into one line
function formatAddress(app) {
  var parts = [
    app.house_no ? app.house_no + (app.house_suffix ? " " + app.house_suffix : "") : "",
    app.unit_no,
    app.floor_no ? "Floor " + app.floor_no : "",
    app.building_name,
    app.street,
    app.subdivision,
    app.barangay ? "Brgy. " + app.barangay : "",
    app.city,
    app.province
  ];
  var clean = [];
  for (var i = 0; i < parts.length; i++) {
    if (parts[i]) clean.push(parts[i]);
  }
  return clean.join(", ");
}

// Is this address inside the Red Fiber service areas?
function isServiceArea(addressText) {
  var text = String(addressText || "").toLowerCase();
  for (var i = 0; i < CONFIG.SERVICE_AREAS.length; i++) {
    if (text.indexOf(CONFIG.SERVICE_AREAS[i]) !== -1) return true;
  }
  return false;
}

// Message shown to the customer for each status
function getDefaultStatusInstruction(status, note) {
  if (status === "Needs Correction") return note || "Please update the information or ID requested below.";
  if (status === "Ready for Encoding") return "Your requirements are complete. We are preparing your application for the provider.";
  if (status === "Provider Processing") return "Your application was sent to the provider. Please wait for the validation result.";
  if (status === "Approved") return note || "Approved. Please wait 3 to 5 business days for installation scheduling. Watch your email and phone for updates.";
  if (status === "Rejected") return note || "Your application did not pass provider validation.";
  return "We are reviewing your application. Please check your email for updates.";
}

function makeBadge(status) {
  var cssName = String(status || "Processing").toLowerCase().replace(/ /g, "-");
  return '<span class="badge status-' + cssName + '">' + status + "</span>";
}

// ============================================================
// Popups and alert messages
// ============================================================

function openPopup(htmlContent, isWide) {
  closePopup();
  var back = document.createElement("div");
  back.id = "popup-modal";
  back.className = "popup-back";
  back.innerHTML = '<div class="popup' + (isWide ? " wide" : "") + '">' + htmlContent + "</div>";
  document.body.appendChild(back);
  if (typeof initPasswordEyeToggles === "function") initPasswordEyeToggles(back);
}

function closePopup() {
  var existing = document.getElementById("popup-modal");
  if (existing) existing.remove();
}

// Simple message popup with an OK button (used instead of red error text)
function showAlert(title, message, type) {
  openPopup(
    "<h3>" + title + "</h3>" +
    '<div class="notice ' + (type || "") + ' mt">' + message + "</div>" +
    '<div class="row mt" style="justify-content:flex-end"><button class="btn btn-red" onclick="closePopup()">OK</button></div>'
  );
}

// Bigger picture preview (client logos, vehicles, permits)
function previewImage(filePath, titleText) {
  openPopup(
    '<div class="row between"><h3>' + titleText + '</h3><button class="btn btn-small" onclick="closePopup()">Close</button></div>' +
    '<img class="mt" src="' + getImageUrl(filePath) + '" onerror="imageFallback(this, \'' + filePath + '\')" style="margin:12px auto 0; max-height:70vh; border-radius:10px;">',
    true
  );
}

// ============================================================
// Public website: phone menu, hero slider, picture strips
// ============================================================

// Open or close the phone side menu
function toggleMenu() {
  document.body.classList.toggle("menu-open");
}

// Build a hero slider that changes picture every 5 seconds
var sliderTimers = {};
function startSlider(sliderId, slides) {
  var box = document.getElementById(sliderId);
  if (!box) return;

  var html = "";
  var dots = "";
  for (var i = 0; i < slides.length; i++) {
    html +=
      '<div class="slide' + (i === 0 ? " active" : "") + '">' +
        '<img src="' + getImageUrl(slides[i].image) + '" onerror="imageFallback(this, \'' + slides[i].image + '\')" alt="' + (slides[i].title || "Banner") + '">' +
        (slides[i].title || slides[i].text
          ? '<div class="slide-text"><div class="container"><h1>' + (slides[i].title || "") + "</h1><p>" + (slides[i].text || "") + "</p></div></div>"
          : "") +
      "</div>";
    dots += '<button class="' + (i === 0 ? "active" : "") + '" onclick="goToSlide(\'' + sliderId + "', " + i + ')" aria-label="Slide ' + (i + 1) + '"></button>';
  }
  html +=
    '<button class="slider-arrow prev" onclick="moveSlide(\'' + sliderId + '\', -1)" aria-label="Previous">&#8249;</button>' +
    '<button class="slider-arrow next" onclick="moveSlide(\'' + sliderId + '\', 1)" aria-label="Next">&#8250;</button>' +
    '<div class="slider-dots">' + dots + "</div>";
  box.innerHTML = html;
  box.setAttribute("data-index", "0");

  clearInterval(sliderTimers[sliderId]);
  sliderTimers[sliderId] = setInterval(function () { moveSlide(sliderId, 1); }, 5000);
}

function goToSlide(sliderId, index) {
  var box = document.getElementById(sliderId);
  var slides = box.querySelectorAll(".slide");
  var dots = box.querySelectorAll(".slider-dots button");
  if (slides.length === 0) return;
  if (index < 0) index = slides.length - 1;
  if (index >= slides.length) index = 0;
  for (var i = 0; i < slides.length; i++) {
    slides[i].classList.toggle("active", i === index);
    dots[i].classList.toggle("active", i === index);
  }
  box.setAttribute("data-index", String(index));
}

function moveSlide(sliderId, step) {
  var box = document.getElementById(sliderId);
  var current = Number(box.getAttribute("data-index") || 0);
  goToSlide(sliderId, current + step);
}

var stripTimers = {};

// Build a horizontal strip of pictures that scrolls automatically AND allows manual scrolling/dragging
function buildStrip(stripId, files, titlePrefix) {
  var box = document.getElementById(stripId);
  if (!box) return;
  var html = "";
  for (var round = 0; round < 2; round++) {
    for (var i = 0; i < files.length; i++) {
      html += '<img draggable="false" src="' + getImageUrl(files[i]) + '" onerror="imageFallback(this, \'' + files[i] + '\')" alt="' + titlePrefix + " " + (i + 1) + '" onclick="if(!window._stripDragged) previewImage(\'' + files[i] + "', '" + titlePrefix + " " + (i + 1) + '\')">';
    }
  }
  box.innerHTML = '<div class="strip-track">' + html + "</div>";

  var paused = false;
  var isDown = false;
  var startX = 0;
  var scrollStart = 0;

  box.onmouseenter = function () { paused = true; };
  box.onmouseleave = function () { paused = false; isDown = false; };
  box.ontouchstart = function () { paused = true; };
  box.ontouchend = function () {
    setTimeout(function () { paused = false; }, 1800);
  };

  box.onmousedown = function (e) {
    isDown = true;
    paused = true;
    window._stripDragged = false;
    startX = e.pageX - box.offsetLeft;
    scrollStart = box.scrollLeft;
  };
  box.onmousemove = function (e) {
    if (!isDown) return;
    e.preventDefault();
    var x = e.pageX - box.offsetLeft;
    var walk = x - startX;
    if (Math.abs(walk) > 6) window._stripDragged = true;
    box.scrollLeft = scrollStart - walk;
  };
  box.onmouseup = function () {
    isDown = false;
    setTimeout(function () { window._stripDragged = false; }, 80);
  };

  if (stripTimers[stripId]) clearInterval(stripTimers[stripId]);
  stripTimers[stripId] = setInterval(function () {
    if (paused) return;
    box.scrollLeft += 1;
    var half = box.scrollWidth / 2;
    if (half > 0 && box.scrollLeft >= half) {
      box.scrollLeft -= half;
    }
  }, 25);
}

// Role landing pages
function getHomeForRole(role) {
  if (role === "admin") return ROOT + "admin.html";
  if (role === "manager") return ROOT + "manager.html";
  if (role === "agent") return ROOT + "agent.html";
  return ROOT + "customer.html";
}

// Global password eye toggle helper
function initPasswordEyeToggles(rootEl) {
  var container = rootEl || document;
  var pwInputs = container.querySelectorAll('input[type="password"]');
  for (var i = 0; i < pwInputs.length; i++) {
    var inp = pwInputs[i];
    if (inp.getAttribute("data-eye-ready") === "1") continue;
    inp.setAttribute("data-eye-ready", "1");

    var wrap = document.createElement("div");
    wrap.className = "pw-wrap";
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pw-eye";
    btn.setAttribute("aria-label", "Show or hide password");
    btn.title = "Show / Hide Password";
    btn.innerHTML =
      '<svg class="eye-open" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
      '<svg class="eye-closed" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
     (function (inputEl, buttonEl) {
      buttonEl.onclick = function () {
        var isPw = inputEl.type === "password";
        inputEl.type = isPw ? "text" : "password";
        var openIcon = buttonEl.querySelector(".eye-open");
        var closedIcon = buttonEl.querySelector(".eye-closed");
        if (openIcon && closedIcon) {
          openIcon.style.display = isPw ? "none" : "block";
          closedIcon.style.display = isPw ? "block" : "none";
        }
      };
    })(inp, btn);
    wrap.appendChild(btn);
  }
}

// Change "Customer Login" to "Apply" + "My Account" when a customer is already signed in
async function setupPublicHeader() {
  if (typeof dbGetCurrentUser !== "function") return;
  var user = await dbGetCurrentUser();
  if (!user || user.role !== "customer") return;

  var accountButtons = document.querySelectorAll(".account-btn");
  for (var i = 0; i < accountButtons.length; i++) {
    accountButtons[i].textContent = "Apply";
    accountButtons[i].href = ROOT + "apply.html";
    accountButtons[i].target = "_blank";
  }
  var customerLinks = document.querySelectorAll(".customer-only");
  for (var j = 0; j < customerLinks.length; j++) {
    customerLinks[j].hidden = false;
  }
}

// Check if the current tab is a Manager or Admin previewing the site during Maintenance Mode
function isManagerOrAdminPreview() {
  if (window.location.search.indexOf("preview_cms=1") !== -1) {
    sessionStorage.setItem("pigem_cms_preview", "1");
    return true;
  }
  if (sessionStorage.getItem("pigem_cms_preview") === "1") return true;
  if (sessionStorage.getItem("pigem_session_staff")) return true;
  if (sessionStorage.getItem("pigem_session_admin")) return true;
  return false;
}

// Block Public Website, Application Form, and Account Activation for customers during Maintenance Mode,
// while allowing the Manager/Admin to preview live changes.
function checkPublicMaintenance() {
  var path = window.location.pathname.toLowerCase();
  var isCoveredPage =
    document.body.classList.contains("public-page") ||
    path.indexOf("index.html") !== -1 ||
    path.indexOf("about.html") !== -1 ||
    path.indexOf("apply.html") !== -1 ||
    path.indexOf("activate.html") !== -1 ||
    path.indexOf("privacy.html") !== -1 ||
    path.indexOf("terms.html") !== -1 ||
    path.endsWith("/");

  if (!isCoveredPage) return;

  var settings = getSystemSettings();
  if (!settings.maintenance_mode) {
    var oldBar = document.getElementById("mgr-preview-bar");
    if (oldBar) oldBar.remove();
    return;
  }

  // Manager / Admin can still preview the live site while Maintenance Mode is ON
  if (isManagerOrAdminPreview()) {
    if (!document.getElementById("mgr-preview-bar")) {
      var bar = document.createElement("div");
      bar.id = "mgr-preview-bar";
      bar.className = "notice warn";
      bar.style.borderRadius = "0";
      bar.style.textAlign = "center";
      bar.innerHTML =
        "<b>🛠 Manager Preview Mode:</b> The Public Website, Application Form, and Account Activation are currently <b>Under Maintenance</b> for customers while you edit content.";
      document.body.insertBefore(bar, document.body.firstChild);
    }
    return;
  }

  // Customer / Public Visitor: block the page completely
  closePopup();
  document.body.innerHTML =
    '<main class="auth-page">' +
      '<div class="card auth-card center" style="max-width:520px">' +
        '<img src="' + getImageUrl((getWebsiteContent().logo_image || "logo.png")) + '" alt="PIGEM" style="height:64px; margin:0 auto 14px" />' +
        '<h2>Website Under Maintenance</h2>' +
        '<p class="muted mt">' +
          (settings.maintenance_message || "The website, application form, and account activation are currently under scheduled maintenance while we update our content. Please come back shortly.") +
        '</p>' +
      '</div>' +
    '</main>';
}

// Run on every page after it loads
window.addEventListener("DOMContentLoaded", async function () {
  if (typeof initPasswordEyeToggles === "function") {
    initPasswordEyeToggles();
  }
  if (typeof dbSyncLiveSettingsAndContent === "function") {
    await dbSyncLiveSettingsAndContent();
  }
  loadPageImages();
  checkPublicMaintenance();
  setupPublicHeader();
});

