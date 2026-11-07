var ROOT = window.ROOT || "";

var CONFIG = {

  SUPABASE_URL: "https://wuunqfxyejxwrawtjdrf.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dW5xZnh5ZWp4d3Jhd3RqZHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNTE3MTEsImV4cCI6MjEwNzcyNzcxMX0.4Wt-6pJpLS4OUf_93bFn1513omGESvMn_E0ulnONf2g",

  PUBLIC_URL: "https://pigem-system-web.vercel.app",
  API_URL: "/api",

  ASSET_SOURCE: "supabase",

  LOCATIONIQ_API_KEY: "pk.3597a6e1a756561513401f40ea9ee840",

  RECAPTCHA_SITE_KEY: "6LfLGBQuAAAAAP3l2jkVbG41srUfH3mv2io15vXD",

  PLANS: [
    { id: "1000", name: "Plan 1000", speed: 100, price: 1000, tag: "Fiber for your home", featured: false },
    { id: "1400", name: "Plan 1400", speed: 300, price: 1400, tag: "Most chosen", featured: true },
    { id: "1900", name: "Plan 1900", speed: 500, price: 1900, tag: "Fiber for your home", featured: false }
  ],

  PLAN_INCLUSIONS: [
    "Unlimited pure fiber internet",
    "No lock-in",
    "Zero modem fee",
    "50% discount on the ₱2,000 one-time installation fee"
  ],

  STATUSES: ["Pending Review", "Under Agent Review", "Encoding", "Approved", "Rejected", "Needs Correction"],

  MAP_CENTER: [14.3294, 120.9367],

  SERVICE_AREAS: [
    "metro manila", "ncr", "national capital region", "manila", "quezon city", "makati", "pasig", "taguig",
    "caloocan", "pasay", "paranaque", "parañaque", "las pinas", "las piñas", "muntinlupa", "marikina",
    "mandaluyong", "san juan", "valenzuela", "malabon", "navotas", "pateros",
    "bulacan", "cavite", "laguna", "rizal", "cebu"
  ],

  UNIT_TYPES: ["House", "Townhouse", "Apartment", "Condominium", "Dormitory", "Commercial"],

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

var DEFAULT_CONTENT = {
  logo_image: "logo.png",
  hero_slides: [
    { tag: "RED FIBER POSTPAID", image: "Banners/home-banner-1.png", title: "Fiber internet for your home", text: "No lock-in. Zero modem fee. 50% off the ₱2,000 installation fee." },
    { tag: "SIMPLENG WIFI", image: "Banners/home-banner-2.png", title: "Apply online, anytime", text: "Send your application and valid ID from your phone or computer." },
    { tag: "LOCAL SUPPORT", image: "Banners/home-banner-3.png", title: "Your local team in Dasmariñas, Cavite", text: "Ready to help with your Red Fiber application from start to installation." },
    { tag: "PURE FIBER PLANS", image: "hero-fleet.png", title: "Fast, unlimited fiber connection", text: "Plans starting at ₱1,000/month with speeds up to 500 Mbps." }
  ],
  area_text: "Available in select Metro Manila, Bulacan, Cavite, Laguna, Rizal, and Cebu areas.",
  announcement: {
    active: false,
    headline: "",
    body: ""
  },
  about_slides: [
    { tag: "ABOUT PIGEM", image: "Banners/about-banner-1.png", title: "About PIGEM", text: "Electrical and telecommunications services in Dasmariñas City, Cavite." },
    { tag: "FIELD OPERATIONS", image: "hero-fleet.png", title: "Our field team", text: "Around 40 trained installers and technicians." },
    { tag: "ESTABLISHED 2021", image: "Banners/about-banner-2.png", title: "Serving since 2021", text: "Established on December 28, 2021." },
    { tag: "TRUSTED PARTNER", image: "Banners/about-banner-3.png", title: "Complete telecommunication support", text: "Guided installation and responsive local coordination." }
  ],

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

var cloudAssetFailures = 0;

function imageFallback(img, filePath) {
  cloudAssetFailures++;
  img.onerror = null;
  img.src = ROOT + "assets/images/placeholder.png";
  if (cloudAssetFailures >= 2) {
    showSystemMaintenanceNotice();
  }
}

function showSystemMaintenanceNotice(customMsg) {
  var existing = document.getElementById("sys-maintenance-banner");
  if (existing) return;
  var banner = document.createElement("div");
  banner.id = "sys-maintenance-banner";
  banner.style.cssText = "background:#dc2626; color:#ffffff; padding:12px 18px; font-size:13.5px; text-align:center; position:sticky; top:0; z-index:99999; font-weight:700; box-shadow:0 3px 10px rgba(0,0,0,0.25);";
  banner.innerHTML = "<b>System Notice:</b> " + (customMsg || "Cloud Asset Storage &amp; Database is temporarily degraded or undergoing maintenance. Public application services are operating under maintenance mode. Hotline: 101-733 (RED) | (046) 458-0908.");
  if (document.body) {
    document.body.insertBefore(banner, document.body.firstChild);
  }
}

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

  if (activeLogo !== "logo.png") {
    var brandImgs = document.querySelectorAll(".brand img, .logo img, .simple-bar img");
    for (var b = 0; b < brandImgs.length; b++) {
      brandImgs[b].src = getImageUrl(activeLogo);
    }
  }
}

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

function isServiceArea(addressText) {
  var text = String(addressText || "").toLowerCase();
  for (var i = 0; i < CONFIG.SERVICE_AREAS.length; i++) {
    if (text.indexOf(CONFIG.SERVICE_AREAS[i]) !== -1) return true;
  }
  return false;
}

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

function showAlert(title, message, type) {
  openPopup(
    "<h3>" + title + "</h3>" +
    '<div class="notice ' + (type || "") + ' mt">' + message + "</div>" +
    '<div class="row mt" style="justify-content:flex-end"><button class="btn btn-red" onclick="closePopup()">OK</button></div>'
  );
}

function previewImage(filePath, titleText) {
  openPopup(
    '<div class="row between"><h3>' + titleText + '</h3><button class="btn btn-small" onclick="closePopup()">Close</button></div>' +
    '<img class="mt" src="' + getImageUrl(filePath) + '" onerror="imageFallback(this, \'' + filePath + '\')" style="margin:12px auto 0; max-height:70vh; border-radius:10px;">',
    true
  );
}

function toggleMenu() {
  document.body.classList.toggle("menu-open");
}

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

function getHomeForRole(role) {
  if (role === "admin") return ROOT + "admin.html";
  if (role === "manager") return ROOT + "manager.html";
  if (role === "agent") return ROOT + "agent.html";
  return ROOT + "customer.html";
}

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

  if (isManagerOrAdminPreview()) {
    if (!document.getElementById("mgr-preview-bar")) {
      var bar = document.createElement("div");
      bar.id = "mgr-preview-bar";
      bar.className = "notice warn";
      bar.style.borderRadius = "0";
      bar.style.textAlign = "center";
      bar.innerHTML =
        "<b>Manager Preview Mode:</b> The Public Website, Application Form, and Account Activation are currently <b>Under Maintenance</b> for customers while you edit content.";
      document.body.insertBefore(bar, document.body.firstChild);
    }
    return;
  }

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

class BaseFieldValidator {
  constructor() {
    this._emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this._gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    this._mobileRegex = /^09\d{9}$/;
    this._stripSeparatorsRegex = /[\s\-]+/g;
  }

  validate(value) {
    throw new Error("Subclasses must implement validate().");
  }

  cleanIdValue(rawValue) {
    return String(rawValue || "").toUpperCase().replace(this._stripSeparatorsRegex, "");
  }
}

class ApplicantFormValidator extends BaseFieldValidator {
  isValidEmail(email) {
    var clean = String(email || "").trim();
    if (!clean) return false;
    return this._emailRegex.test(clean);
  }

  isCustomerGmail(email) {
    var clean = String(email || "").trim();
    if (!clean) return false;
    return this._gmailRegex.test(clean);
  }

  isStaffBusinessEmail(email) {
    var clean = String(email || "").trim().toLowerCase();
    if (!clean || !this._emailRegex.test(clean)) return false;
    if (this._gmailRegex.test(clean) || /@(googlemail|yahoo|outlook|hotmail)\.com$/i.test(clean)) {
      return false;
    }
    return true;
  }

  isValidMobile(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (digits.length === 11) {
      if (this._mobileRegex.test(digits)) {
        return true;
      }
    }
    return false;
  }

  validateIdByType(idTypeName, rawNumber) {
    var cleaned = this.cleanIdValue(rawNumber);
    if (!cleaned) {
      return { valid: false, message: "Please enter your Valid ID number." };
    }
    var spec = getIdType(idTypeName);
    if (spec && spec.pattern) {
      if (!spec.pattern.test(cleaned)) {
        return { valid: false, message: spec.hint || "Invalid ID format." };
      }
    }
    return { valid: true, message: "Valid format." };
  }

  validate(formFields) {
    if (!formFields) return { valid: false, field: "form" };
    if (!this.isCustomerGmail(formFields.email)) {
      return { valid: false, field: "email" };
    }
    if (!this.isValidMobile(formFields.phone)) {
      return { valid: false, field: "phone" };
    }
    var idCheck = this.validateIdByType(formFields.id_type, formFields.id_number);
    if (!idCheck.valid) {
      return { valid: false, field: "id_number", message: idCheck.message };
    }
    return { valid: true, field: "" };
  }
}

var FORM_VALIDATOR = new ApplicantFormValidator();

function isCustomerGmail(email) {
  return FORM_VALIDATOR.isCustomerGmail(email);
}

function isStaffBusinessEmail(email) {
  return FORM_VALIDATOR.isStaffBusinessEmail(email);
}

var DEFAULT_POPUP_GUIDES = [
  {
    id: "home_welcome",
    portal: "home",
    audience_tone: "polite_simple",
    title: "Welcome to PIGEM Red Fiber Online Services",
    intro: "Thank you for visiting PIGEM Combined Facilities Support Services. Here is a quick guide on how to explore plans and apply online:",
    steps: [
      "Browse our pure fiber plans below to compare monthly rates and speeds.",
      "Click Apply Now on your preferred plan when you are ready to register.",
      "Prepare one clear photo of a valid government or company ID and an active @gmail.com email address.",
      "Already applied? Click Customer Login at the top right to sign in with your Gmail account and check your status."
    ],
    footer_note: "Need assistance? Call our local desk at (046) 458-0908 or Hotline 101-733 (RED).",
    button_label: "Got It",
    auto_show: false,
    active: true
  },
  {
    id: "apply_before_start",
    portal: "apply",
    audience_tone: "polite_simple",
    title: "Before You Start Your Application",
    intro: "Welcome! To make your Red Fiber registration smooth and hassle-free, please take note of these simple reminders:",
    steps: [
      "Step 1 - Choose Your Plan & Location: Select your fiber plan and pin your exact installation address on the map.",
      "Step 2 - Verify Your Gmail & Mobile Number: Enter your complete name and active @gmail.com address to receive your 6-digit verification code.",
      "Step 3 - Upload Clear Valid ID Photos: Make sure your ID name, birth date, and ID number are clear and readable with good lighting.",
      "Step 4 - Quick Submission: Once submitted, you will immediately receive your Reference Number while our team reviews your application."
    ],
    footer_note: "Your personal information and ID photos are protected under the Data Privacy Act of 2012 (RA 10173).",
    button_label: "Proceed to Application Form",
    auto_show: true,
    active: true
  },
  {
    id: "customer_portal_guide",
    portal: "customer",
    audience_tone: "polite_simple",
    title: "Welcome to Your Customer Account",
    intro: "Here you can conveniently monitor your Red Fiber application and respond to any update requests from our team:",
    steps: [
      "Processing: Our team is verifying your details and coordinating your application.",
      "Action Needed (Under Processing): If an update box appears on your card, simply edit the requested detail or upload a clearer ID photo and click Submit.",
      "Approved: Your application passed verification. Please allow 3 to 5 business days for installation scheduling.",
      "Rejected: View the remarks on your card or contact our support desk if you wish to re-apply."
    ],
    footer_note: "You can reopen this guide anytime using the Guide button at the top bar.",
    button_label: "Continue to My Account",
    auto_show: true,
    active: true
  },
  {
    id: "agent_workspace_guide",
    portal: "agent",
    audience_tone: "polite_simple",
    title: "Agent Workspace Quick Guide",
    intro: "Welcome! Everything in your workspace is organized into clear sections so you can review applications smoothly:",
    steps: [
      "1. Screening Banner & Queue: New applications undergo cloud document checking in the background. Preliminary findings are shown for your review before any customer update is requested.",
      "2. Applicant Details & Valid ID Check: Open any application to compare the customer's form details side-by-side with their Cropped Copy or Original ID Photo.",
      "3. Update Application Status: Record your verification progress (Under Agent Review, Encoding) and save the final Validator decision (Approved or Rejected).",
      "4. Confirm Customer Update Request: If a name, birth date, ID number, address, or ID photo needs a correction, review the pre-drafted message in Section 4 and send a polite update notice."
    ],
    footer_note: "Tip: Screening results are preliminary—always inspect the ID photo before confirming a status change.",
    button_label: "Start Reviewing",
    auto_show: true,
    active: true
  },
  {
    id: "manager_dashboard_guide",
    portal: "manager",
    audience_tone: "polite_simple",
    title: "Manager Dashboard & CMS Guide",
    intro: "Welcome to the Management Portal. Use the organized sidebar sections to oversee operations and website content safely:",
    steps: [
      "Operations & Analytics: Monitor daily applications, conversion rates, barangay activity, and agent workloads.",
      "Application Oversight: Inspect any customer record, reassign applications between agents, or apply a status override when needed.",
      "Website Content (CMS) & Announcements: Update banners, plans, company story, strips, FAQs, and publish customer announcements or offers.",
      "In-System Status Notices: Internal notifications alert your dashboard whenever Auto-Screening or Maintenance Mode is updated by the Admin."
    ],
    footer_note: "Internal business accounts (@pigem.com) for Agents and Manager are managed by the System Administrator.",
    button_label: "Open Dashboard",
    auto_show: true,
    active: true
  },
  {
    id: "admin_technical_guide",
    portal: "admin",
    audience_tone: "technical",
    title: "Technical Administration & Cloud Architecture Reference",
    intro: "Technical overview of cloud serverless endpoints, AI-assisted requirements screening, account governance, and in-system status notifications:",
    steps: [
      "Vercel Serverless FastAPI (/api): Hosts REST endpoints (/api/health, /api/verify-captcha, /api/screen-async, /api/screen, /api/notify, /api/polite-remark) alongside public and internal web portals.",
      "Two-Stage OpenCV + Gemini Vision Pipeline: Stage 1 runs OpenCV blur, glare, brightness, and contrast diagnostics; Stage 2 generates a 4-corner perspective-cropped working copy in documents/cropped/ and executes Google Gemini Vision OCR + deterministic field comparison for human Agent review.",
      "Identity & Notification Separation: Customers authenticate exclusively with @gmail.com accounts and receive Gmail SMTP notifications; the single provisioned Admin manages @pigem.com business credentials for Agents and the Manager, who receive in-system website notifications.",
      "Maintenance, AI & Pop-up Controls: All state switches require explicit confirmation and broadcast in-system status notifications to Agents and the Manager."
    ],
    footer_note: "All administrative toggles and RBAC changes are recorded in public.system_logs.",
    button_label: "Acknowledge Technical Guide",
    auto_show: true,
    active: true
  }
];

function getPopupGuides() {
  var saved = readSaved("pigem_popup_guides", null);
  if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_POPUP_GUIDES;
  var map = {};
  for (var i = 0; i < saved.length; i++) {
    if (saved[i] && saved[i].id) map[saved[i].id] = saved[i];
  }
  var merged = [];
  for (var j = 0; j < DEFAULT_POPUP_GUIDES.length; j++) {
    var def = DEFAULT_POPUP_GUIDES[j];
    merged.push(map[def.id] ? Object.assign({}, def, map[def.id]) : def);
  }
  return merged;
}

class PopupGuideManager {
  constructor() {
    this._sessionPrefix = "pigem_guide_seen_";
  }

  getGuide(guideId) {
    var list = getPopupGuides();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === guideId) return list[i];
    }
    return null;
  }

  renderGuideModal(guide, onDone) {
    if (!guide) return;
    var isTech = guide.audience_tone === "technical";
    var badgeHtml = isTech
      ? '<span class="badge badge-gray">Technical Admin Reference</span>'
      : '<span class="badge badge-green">Quick Guide</span>';

    var stepsArr = Array.isArray(guide.steps) ? guide.steps : [];
    var stepsHtml = "";
    for (var i = 0; i < stepsArr.length; i++) {
      stepsHtml +=
        '<div class="guide-step-row">' +
          '<span class="guide-step-num">' + (i + 1) + '</span>' +
          '<div>' + stepsArr[i] + '</div>' +
        '</div>';
    }

    window._activeGuideDoneCallback = typeof onDone === "function" ? onDone : null;

    var html =
      '<div class="row between" style="margin-bottom:8px;">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '<h3 style="margin:0;">' + guide.title + '</h3>' +
          badgeHtml +
        '</div>' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="finishPortalGuide()">Close</button>' +
      '</div>' +
      '<p class="small muted" style="margin-bottom:10px;line-height:1.55;">' + (guide.intro || "") + '</p>' +
      '<div class="guide-steps">' + stepsHtml + '</div>' +
      (guide.footer_note
        ? '<div class="notice mt" style="font-size:12.5px;">' + guide.footer_note + '</div>'
        : '') +
      '<div class="row mt" style="justify-content:flex-end;">' +
        '<button type="button" class="btn btn-red" onclick="finishPortalGuide()">' + (guide.button_label || "Continue") + '</button>' +
      '</div>';

    openPopup(html, true);
  }

  showGuide(guideId, onDone) {
    var guide = this.getGuide(guideId);
    if (!guide) return;
    sessionStorage.setItem(this._sessionPrefix + guideId, "1");
    this.renderGuideModal(guide, onDone);
  }

  autoShowForPortal(guideId, onDone) {
    var guide = this.getGuide(guideId);
    if (!guide || guide.active === false || guide.auto_show === false) {
      if (typeof onDone === "function") onDone();
      return;
    }
    if (sessionStorage.getItem(this._sessionPrefix + guideId) === "1") {
      if (typeof onDone === "function") onDone();
      return;
    }
    sessionStorage.setItem(this._sessionPrefix + guideId, "1");
    this.renderGuideModal(guide, onDone);
  }
}

var POPUP_GUIDE_MANAGER = new PopupGuideManager();

function showPortalGuide(guideId, onDone) {
  POPUP_GUIDE_MANAGER.showGuide(guideId, onDone);
}

function finishPortalGuide() {
  var cb = window._activeGuideDoneCallback;
  window._activeGuideDoneCallback = null;
  closePopup();
  if (typeof cb === "function") cb();
}

function openConfirmPopup(title, messageHtml, confirmLabel, onConfirm, isDanger) {
  window._pendingConfirmAction = typeof onConfirm === "function" ? onConfirm : null;
  var btnClass = isDanger ? "btn btn-red" : "btn btn-green";
  openPopup(
    '<div class="row between" style="margin-bottom:8px;">' +
      '<h3>' + title + '</h3>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="closePopup()">Cancel</button>' +
    '</div>' +
    '<div class="notice ' + (isDanger ? "warn" : "") + ' mt" style="font-size:13.5px;line-height:1.55;">' + messageHtml + '</div>' +
    '<div class="row mt" style="justify-content:flex-end;gap:8px;">' +
      '<button type="button" class="btn btn-outline" onclick="closePopup()">Cancel</button>' +
      '<button type="button" class="' + btnClass + '" onclick="runPendingConfirmAction()">' + (confirmLabel || "Confirm") + '</button>' +
    '</div>'
  );
}

function runPendingConfirmAction() {
  var fn = window._pendingConfirmAction;
  window._pendingConfirmAction = null;
  closePopup();
  if (typeof fn === "function") fn();
}
