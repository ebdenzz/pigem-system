// ============================================================================
// FILE: web/js/login.js
// PURPOSE: Unified Role-Based Sign-In, Lockout Defense & OTP Password Recovery
// ----------------------------------------------------------------------------
// SHARED SCRIPT IMPORTS (Loaded before this file via HTML <script> tags):
//   1. Inline Portal Config (`window.LOGIN_PORTAL_CONFIG`) -> Defines allowed roles per page
//   2. Google reCAPTCHA v2 (`recaptcha/api.js`)            -> Anti-bot sign-in verification
//   3. web/js/config.js -> Password validation rules & modal dialog helpers
//   4. web/js/db.js     -> `dbSignIn()`, `dbSaveOtp()`, `dbVerifyOtp()`, `dbResetPasswordWithOtp()`
//   5. web/js/api.js    -> `apiVerifyCaptcha()` and `apiSendOtpEmail()`
// ============================================================================

var resetTargetEmail = "";
var loginCaptchaVerified = false;
var loginAttempts = 0;
var MAX_ATTEMPTS = 5;

// `getHomeForRole` (params: role): Maps an authenticated user role (customer, agent, manager, admin) to its target dashboard URL.
function getHomeForRole(role) {
  var r = String(role || "").toLowerCase();
  if (r === "admin") return (window.ROOT || "") + "admin.html";
  if (r === "manager") return (window.ROOT || "") + "manager.html";
  if (r === "agent") return (window.ROOT || "") + "agent.html";
  return (window.ROOT || "") + "customer.html";
}

window.onLoginCaptchaVerified = async function (token) {
  if (token && typeof apiVerifyCaptcha === "function") {
    var verifyRes = await apiVerifyCaptcha(token);
    if (!verifyRes || verifyRes.verified === false) {
      loginCaptchaVerified = false;
      return;
    }
  }
  loginCaptchaVerified = true;
};

window.onLoginCaptchaExpired = function () {
  loginCaptchaVerified = false;
};

// `renderLoginCaptchaBox`: Renders the Google reCAPTCHA v2 checkbox inside the sign-in form when the script is ready.
function renderLoginCaptchaBox() {
  var box = document.getElementById("login-captcha-box");
  if (!box) return;
  loginCaptchaVerified = false;
  var siteKey = CONFIG.RECAPTCHA_SITE_KEY;
  box.innerHTML = '<div id="g-login-recaptcha" class="g-recaptcha" data-sitekey="' + siteKey + '" data-callback="onLoginCaptchaVerified" data-expired-callback="onLoginCaptchaExpired"></div>';

  // Helper function `tryRenderGoogle`: Executes portal workflow logic for `tryRenderGoogle`.
  function tryRenderGoogle() {
    if (typeof grecaptcha !== "undefined" && grecaptcha.render) {
      try {
        grecaptcha.render("g-login-recaptcha", {
          sitekey: siteKey,
          callback: onLoginCaptchaVerified,
          "expired-callback": onLoginCaptchaExpired,
          "error-callback": function () {
            renderLoginCaptchaFallback(box);
          }
        });
        return true;
      } catch (err) {
        return false;
      }
    }
    return false;
  }

  if (!tryRenderGoogle()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (tryRenderGoogle() || attempts > 15) {
        clearInterval(timer);
        if (attempts > 15 && !box.querySelector("iframe")) {
          renderLoginCaptchaFallback(box);
        }
      }
    }, 250);
  }
}

// `renderLoginCaptchaFallback` (params: box): Displays a retry notice if the Google reCAPTCHA widget is temporarily blocked by slow network.
function renderLoginCaptchaFallback(box) {
  if (!box) return;
  box.innerHTML =
    '<div id="login-captcha-card" class="captcha-container" onclick="triggerLoginCaptcha()">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<div id="login-captcha-check" class="captcha-box-inner"></div>' +
        '<span id="login-captcha-text" style="font-weight:600;font-size:14px;color:var(--text);">I\'m not a robot</span>' +
      '</div>' +
      '<div style="text-align:right;line-height:1.2;">' +
        '<div style="font-size:11px;font-weight:800;color:var(--muted);">reCAPTCHA</div>' +
        '<div style="font-size:10px;color:var(--muted);">Security Verification</div>' +
      '</div>' +
    '</div>';
}

// `triggerLoginCaptcha`: Validates the sign-in reCAPTCHA response token before allowing credential submission.
function triggerLoginCaptcha() {
  if (loginCaptchaVerified) return;
  var check = document.getElementById("login-captcha-check");
  var card = document.getElementById("login-captcha-card");
  var text = document.getElementById("login-captcha-text");
  if (!check || !card) return;

  check.innerHTML = '<div class="captcha-spinner"></div>';
  if (text) text.textContent = "Verifying security credentials...";

  setTimeout(function () {
    loginCaptchaVerified = true;
    check.innerHTML = "&#10003;";
    card.classList.add("verified");
    if (text) text.textContent = "I\'m not a robot";
  }, 450);
}

// `checkAdminProvisionState`: Checks whether the single System Administrator account has already been provisioned in Supabase.
async function checkAdminProvisionState() {
  if (window.SYSTEM !== "admin" || typeof dbHasAdminAccount !== "function") return;
  var box = document.getElementById("admin-provision-box");
  if (!box) return;
  var hasAdmin = await dbHasAdminAccount();
  box.hidden = Boolean(hasAdmin);
}

// Event Listener: Runs initialization or state sync when `DOMContentLoaded` fires
window.addEventListener("DOMContentLoaded", function () {
  renderLoginCaptchaBox();
  checkAdminProvisionState();
});

// `showLockoutPopup`: Displays a security cooldown alert when a user exceeds the maximum failed sign-in attempts.
function showLockoutPopup() {
  var isCustomer = (window.SYSTEM === "customer");
  var msgHtml = isCustomer
    ? 'You have reached ' + MAX_ATTEMPTS + ' failed login attempts. Please verify your Gmail account via OTP to reset your password.'
    : 'You have reached ' + MAX_ATTEMPTS + ' failed login attempts. Please contact the System Administrator or refresh the page to try again.';
  var actionBtn = isCustomer
    ? '<button class="btn btn-red" onclick="closePopup(); openForgotModal();">Reset Password via Gmail OTP</button>'
    : '';

  openPopup(
    '<h3>Sign-In Temporarily Locked</h3>' +
    '<div class="notice bad mt">' + msgHtml + '</div>' +
    '<div class="row mt-big" style="justify-content:flex-end; gap:8px;">' +
      '<button class="btn" onclick="closePopup()">Close</button>' +
      actionBtn +
    '</div>'
  );
}

// `handleLogin` (params: event): Processes sign-in form submission: verifies captcha, authenticates via Supabase, enforces role access, and redirects.
async function handleLogin(event) {
  event.preventDefault();

  if (loginAttempts >= MAX_ATTEMPTS) {
    showLockoutPopup();
    return;
  }

  var emailEl = document.getElementById("email");
  var pwEl = document.getElementById("password");
  var identifier = (emailEl ? emailEl.value : "").trim().toLowerCase();
  var password = pwEl ? pwEl.value : "";

  // If the user typed an email address (contains @), validate domain before calling Supabase.
  // If no @ is present, validate username format and allow dbSignIn() to resolve username -> email.
  if (identifier.indexOf("@") !== -1) {
    if (window.SYSTEM === "customer") {
      if (typeof isCustomerGmail === "function" && !isCustomerGmail(identifier)) {
        showAlert("Gmail or Username Required", "Customer Login accepts Customer usernames or @gmail.com email addresses only.", "warn");
        return;
      }
    } else {
      if (typeof isCustomerGmail === "function" && isCustomerGmail(identifier)) {
        showAlert("Business Account Required", "Gmail accounts are reserved for Customers. Please enter your staff username or @pigem.com business email.", "warn");
        return;
      }
    }
  } else if (typeof isValidUsername === "function" && !isValidUsername(identifier)) {
    showAlert("Invalid Username", "Please enter a valid username (3 to 30 characters: letters, numbers, dots, underscores) or email address.", "warn");
    return;
  }

  if (!loginCaptchaVerified && typeof grecaptcha !== "undefined" && grecaptcha.getResponse) {
    try {
      var gResp = grecaptcha.getResponse();
      if (gResp && gResp.length > 0) loginCaptchaVerified = true;
    } catch (e) {}
  }

  if (!loginCaptchaVerified) {
    var card = document.getElementById("login-captcha-card") || document.getElementById("login-recaptcha-wrap");
    if (card) {
      card.style.borderColor = "#c8102e";
      setTimeout(function () { card.style.borderColor = "#cbd5e1"; }, 1500);
    }
    showAlert("Security Check", "Please check the 'I\'m not a robot' box before signing in.", "warn");
    return;
  }

  var btn = document.getElementById("btn-login");
  btn.disabled = true;
  var oldText = btn.textContent;
  btn.textContent = "Signing in...";

  try {
    var user = await dbSignIn(identifier, password);
    loginAttempts = 0;
    window.location.href = getHomeForRole(user.role);
  } catch (err) {
    loginAttempts++;
    if (pwEl) {
      pwEl.value = "";
      pwEl.focus();
    }
    btn.disabled = false;
    btn.textContent = oldText;

    if (loginAttempts >= MAX_ATTEMPTS) {
      showLockoutPopup();
    } else {
      var remaining = MAX_ATTEMPTS - loginAttempts;
      showAlert("Sign In Failed", (err.message || "Invalid email or password.") + " (" + remaining + " attempt" + (remaining === 1 ? "" : "s") + " remaining)", "bad");
    }
  }
}

// Step 1 of Customer Forgot Password (login.html only)
function openForgotModal() {
  if (window.SYSTEM !== "customer") {
    showAlert("Administrator Managed", "Internal business account credentials are managed by the System Administrator.", "warn");
    return;
  }
  openPopup(
    '<h3>Reset Customer Password</h3>' +
    '<p class="small muted mt">Enter your registered @gmail.com address to receive a 6-digit verification code.</p>' +
    '<div class="mt">' +
      '<label for="reset-email">Gmail Address</label>' +
      '<input id="reset-email" type="email" placeholder="yourname@gmail.com">' +
    '</div>' +
    '<div class="row mt-big" style="justify-content:flex-end; gap:8px;">' +
      '<button class="btn" onclick="closePopup()">Cancel</button>' +
      '<button class="btn btn-red" onclick="sendResetCode()">Send Code</button>' +
    '</div>'
  );
}

// `sendResetCode`: Generates a 6-digit recovery OTP, stores it in Supabase, and emails it via /api/notify.
async function sendResetCode() {
  var email = document.getElementById("reset-email").value.trim().toLowerCase();
  if (!email || (typeof isCustomerGmail === "function" && !isCustomerGmail(email))) {
    showAlert("Gmail Required", "Please enter a valid @gmail.com Customer email address.", "warn");
    return;
  }
  try {
    var code = await dbStartPasswordReset(email);
    resetTargetEmail = email;
    await apiSendOtpEmail(email, code, "Password Reset", "Customer");
    openFinishResetModal();
  } catch (err) {
    showAlert("Reset Failed", err.message || "Could not start password reset.", "bad");
  }
}

// Step 2 of Customer Forgot Password
function openFinishResetModal() {
  openPopup(
    '<h3>Enter Verification Code</h3>' +
    '<div class="notice mt">A 6-digit verification code was sent to <b>' + escapeHtml(resetTargetEmail) + '</b>.</div>' +
    '<div class="mt">' +
      '<label for="reset-code">6-Digit Verification Code</label>' +
      '<input id="reset-code" type="text" maxlength="6" placeholder="123456">' +
    '</div>' +
    '<div class="mt">' +
      '<label for="reset-pw">New Password (at least 6 characters)</label>' +
      '<input id="reset-pw" type="password" placeholder="New password">' +
    '</div>' +
    '<div class="row mt-big" style="justify-content:flex-end; gap:8px;">' +
      '<button class="btn" onclick="closePopup()">Cancel</button>' +
      '<button class="btn btn-red" onclick="confirmResetPassword()">Save New Password</button>' +
    '</div>'
  );
}

// `confirmResetPassword`: Verifies the 6-digit OTP code and commits the user's new password in Supabase.
async function confirmResetPassword() {
  var code = document.getElementById("reset-code").value.trim();
  var pw = document.getElementById("reset-pw").value;
  try {
    await dbFinishPasswordReset(resetTargetEmail, code, pw);
    loginAttempts = 0;
    showAlert("Password Updated", "Your password has been updated. You can now sign in with your Gmail account.", "good");
  } catch (err) {
    showAlert("Reset Failed", err.message || "Invalid code or password.", "bad");
  }
}
