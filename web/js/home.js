// ============================================================
// HOME PAGE SCRIPT (Hero Slider, Plans, and Closed-by-Default FAQs)
// ============================================================

// Build one Red Fiber plan card (opens apply.html in a new tab)
function buildPlanCard(plan) {
  var borderClass = plan.featured ? "card plan red-border" : "card plan";
  var buttonClass = plan.featured ? "btn btn-red btn-full" : "btn btn-full";

  var listHtml = "";
  for (var i = 0; i < CONFIG.PLAN_INCLUSIONS.length; i++) {
    listHtml += "<li>" + CONFIG.PLAN_INCLUSIONS[i] + "</li>";
  }

  return (
    '<div class="' + borderClass + '">' +
      '<span class="tag">' + (plan.tag || "Fiber for your home") + '</span>' +
      '<h3 class="mt">' + plan.name + '</h3>' +
      '<div class="speed">' + plan.speed + ' <span>Mbps</span></div>' +
      '<p class="price">' + formatPeso(plan.price) + ' <span>/ month</span></p>' +
      '<ul>' + listHtml + '</ul>' +
      '<a href="apply.html?plan=' + plan.id + '" target="_blank" class="' + buttonClass + '">Apply for ' + plan.name + '</a>' +
    '</div>'
  );
}

// Render Hero Slider, Plans, and FAQs on load
function initHomePage() {
  var content = getWebsiteContent();

  // 1. Start auto-sliding Hero Banner
  startSlider("home-slider", content.hero_slides || DEFAULT_CONTENT.hero_slides);

  // 2. Service area strip text
  var areaBar = document.getElementById("area-bar");
  if (areaBar && content.area_text) {
    areaBar.textContent = content.area_text;
  }

  // 3. Render Internet Plans
  var plans = getActivePlans();
  var planBox = document.getElementById("plan-cards");
  if (planBox) {
    var html = "";
    for (var i = 0; i < plans.length; i++) {
      html += buildPlanCard(plans[i]);
    }
    planBox.innerHTML = html;
  }

  // 4. Render FAQs (all closed on page load/refresh)
  var faqBox = document.getElementById("faq-list");
  if (faqBox && content.faqs) {
    var faqHtml = "";
    for (var j = 0; j < content.faqs.length; j++) {
      faqHtml +=
        "<details>" +
          "<summary>" + content.faqs[j].q + "</summary>" +
          "<p>" + content.faqs[j].a + "</p>" +
        "</details>";
    }
    faqBox.innerHTML = faqHtml;
  }

  // 5. Render Client / Partner logos if a .logos container exists on the page
  var logosBox = document.querySelector(".logos");
  var clientImgs = content.client_images || DEFAULT_CONTENT.client_images;
  if (logosBox && clientImgs && clientImgs.length) {
    logosBox.innerHTML = clientImgs.map(function (imgPath, idx) {
      return '<img data-img="' + imgPath + '" src="' + getImageUrl(imgPath) + '" alt="Partner ' + (idx + 1) + '" onerror="imageFallback(this, \'' + imgPath + '\')" onclick="previewImage(\'' + imgPath + '\', \'Partner ' + (idx + 1) + '\')">';
    }).join("");
  }
}

window.onLiveContentSynced = initHomePage;
initHomePage();

