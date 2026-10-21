// ============================================================
// SHARED LOGIN & PASSWORD RESET LOGIC
// Used by login.html (Customer), staff-login.html (Internal Staff),
// and admin-login.html (Admin).
// ============================================================

var resetTargetEmail = "";
var loginCaptchaVerified = false;
var loginAttempts = 0;
var MAX_ATTEMPTS = 5;

function getHomeForRole(role) {
  var r = String(role || "").toLowerCase();
  if (r === "admin") return (window.ROOT || "") + "admin.html";
  if (r === "manager") return (window.ROOT || "") + "manager.html";
  if (r === "agent") return (window.ROOT || "") + "agent.html";
  return (window.ROOT || "") + "customer.html";
}

function renderLoginCaptchaBox() {
  var box = document.getElementById("login-captcha-box");
  if (!box) return;
  loginCaptchaVerified = false;
  box.innerHTML =
    '<div id="login-captcha-card" class="captcha-container" onclick="triggerLoginCaptcha()">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<div id="login-captcha-check" class="captcha-box-inner"></div>' +
        '<span id="login-captcha-text" style="font-weight:600;font-size:14px;color:var(--text);">I\'m not a robot</span>' +
      '</div>' +
      '<div style="text-align:right;line-height:1.2;">' +
        '<div style="font-size:11px;font-weight:800;color:var(--muted);">CAPTCHA</div>' +
        '<div style="font-size:10px;color:var(--muted);">Security Verification</div>' +
      '</div>' +
    '</div>';
}

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
    if (text) text.textContent = "I'm not a robot";
  }, 600);
}

window.addEventListener("DOMContentLoaded", function () {
  renderLoginCaptchaBox();
});

async function handleLogin(event) {
  event.preventDefault();

  if (loginAttempts >= MAX_ATTEMPTS) {
    openPopup(
      '<h3>Account Locked</h3>' +
      '<div class="notice bad mt">Your account has been temporarily locked due to 5 consecutive failed login attempts. Please click below to reset your password.</div>' +
      '<div class="row mt-big" style="justify-content:flex-end; gap:8px;">' +
        '<button class="btn" onclick="closePopup()">Close</button>' +
        '<button class="btn btn-red" onclick="closePopup(); openForgotModal();">Reset Password Now</button>' +
      '</div>'
    );
    return;
  }

  if (!loginCaptchaVerified) {
    var card = document.getElementById("login-captcha-card");
    if (card) {
      card.style.borderColor = "#c8102e";
      setTimeout(function () { card.style.borderColor = "#cbd5e1"; }, 1500);
    }
    showAlert("Security Check", "Please check the 'I\'m not a robot' box before signing in.", "warn");
    return;
  }

  var emailEl = document.getElementById("email");
  var pwEl = document.getElementById("password");
  var email = (emailEl ? emailEl.value : "").trim();
  var password = pwEl ? pwEl.value : "";
  var btn = document.getElementById("btn-login");

  btn.disabled = true;
  var oldText = btn.textContent;
  btn.textContent = "Signing in...";

  try {
    var user = await dbSignIn(email, password);
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
      openPopup(
        '<h3>Account Locked</h3>' +
        '<div class="notice bad mt">You have exceeded the maximum of ' + MAX_ATTEMPTS + ' failed login attempts. For security reasons, please reset your password.</div>' +
        '<div class="row mt-big" style="justify-content:flex-end; gap:8px;">' +
          '<button class="btn" onclick="closePopup()">Close</button>' +
          '<button class="btn btn-red" onclick="closePopup(); openForgotModal();">Reset Password Now</button>' +
        '</div>'
      );
    } else {
      var remaining = MAX_ATTEMPTS - loginAttempts;
      showAlert("Sign In Failed", (err.message || "Invalid email or password.") + " (" + remaining + " attempt" + (remaining === 1 ? "" : "s") + " remaining)", "bad");
    }
  }
}

// Step 1 of Forgot Password: enter email address to receive 6-digit reset code
function openForgotModal() {
  openPopup(
    '<h3>Reset Your Password</h3>' +
    '<p class="small muted mt">Enter your account email address. We will send a 6-digit verification code to reset your password.</p>' +
    '<div class="mt">' +
      '<label for="reset-email">Email Address</label>' +
      '<input id="reset-email" type="email" placeholder="Enter your email">' +
    '</div>' +
    '<div class="row mt-big" style="justify-content:flex-end">' +
      '<button class="btn" onclick="closePopup()">Cancel</button>' +
      '<button class="btn btn-red" onclick="sendResetCode()">Send Code</button>' +
    '</div>'
  );
}

async function sendResetCode() {
  var email = document.getElementById("reset-email").value.trim().toLowerCase();
  if (!email) {
    showAlert("Email Required", "Please enter your email address.", "warn");
    return;
  }
  try {
    var code = await dbStartPasswordReset(email);
    resetTargetEmail = email;
    var subject = "PIGEM Account Security — Password Reset Verification Code";
    var body =
      "Dear Valued Client,\n\n" +
      "We received a request to reset the password associated with your PIGEM account (" + email + ").\n\n" +
      "Your 6-Digit Password Reset Verification Code is: " + code + "\n\n" +
      "Please enter this verification code on the password reset screen to set your new password.\n\n" +
      "Sincerely,\n" +
      "PIGEM Combined Facilities Support Services";
    await apiSendEmail(email, subject, body);
    openFinishResetModal(code);
  } catch (err) {
    showAlert("Reset Failed", err.message || "Could not start password reset.", "bad");
  }
}

// Step 2 of Forgot Password: enter the 6-digit code + new password
function openFinishResetModal(demoCode) {
  openPopup(
    '<h3>Enter Verification Code</h3>' +
    '<div class="notice mt">A 6-digit verification code was sent to <b>' + resetTargetEmail + '</b>' +
      (demoCode ? ' (Verification Code: <b>' + demoCode + '</b>)' : '') +
    '.</div>' +
    '<div class="mt">' +
      '<label for="reset-code">6-Digit Verification Code</label>' +
      '<input id="reset-code" type="text" maxlength="6" placeholder="123456">' +
    '</div>' +
    '<div class="mt">' +
      '<label for="reset-pw">New Password (at least 6 characters)</label>' +
      '<input id="reset-pw" type="password" placeholder="New password">' +
    '</div>' +
    '<div class="row mt-big" style="justify-content:flex-end">' +
      '<button class="btn" onclick="closePopup()">Cancel</button>' +
      '<button class="btn btn-red" onclick="confirmResetPassword()">Save New Password</button>' +
    '</div>'
  );
}

async function confirmResetPassword() {
  var code = document.getElementById("reset-code").value.trim();
  var pw = document.getElementById("reset-pw").value;
  try {
    await dbFinishPasswordReset(resetTargetEmail, code, pw);
    loginAttempts = 0;
    showAlert("Password Updated", "Your password has been changed. You can now sign in with your new password.", "good");
  } catch (err) {
    showAlert("Reset Failed", err.message || "Invalid code or password.", "bad");
  }
}
