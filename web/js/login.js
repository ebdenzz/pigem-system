// ============================================================
// SHARED LOGIN & PASSWORD RESET LOGIC
// Used by login.html (Customer), staff-login.html (Agent/Manager),
// and admin-login.html (Admin).
// ============================================================

var resetTargetEmail = "";
var loginCaptchaVerified = false;

function renderLoginCaptchaBox() {
  var box = document.getElementById("login-captcha-box");
  if (!box) return;
  loginCaptchaVerified = false;
  box.innerHTML =
    '<div id="login-captcha-card" onclick="toggleLoginCaptcha()" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg-soft);cursor:pointer;user-select:none;">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<div id="login-captcha-check" style="width:24px;height:24px;border:2px solid #98a2b3;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;transition:all 0.15s;"></div>' +
        '<span style="font-weight:600;font-size:14px;">I\'m not a robot</span>' +
      '</div>' +
      '<div style="text-align:right;line-height:1.2;">' +
        '<div style="font-size:11px;font-weight:700;color:var(--muted);">CAPTCHA</div>' +
        '<div style="font-size:10px;color:var(--muted);">Security Check</div>' +
      '</div>' +
    '</div>';
}

function toggleLoginCaptcha() {
  loginCaptchaVerified = !loginCaptchaVerified;
  var check = document.getElementById("login-captcha-check");
  var card = document.getElementById("login-captcha-card");
  if (!check || !card) return;
  if (loginCaptchaVerified) {
    check.style.background = "#12b76a";
    check.style.borderColor = "#12b76a";
    check.innerHTML = "&#10003;";
    card.style.borderColor = "#12b76a";
  } else {
    check.style.background = "#fff";
    check.style.borderColor = "#98a2b3";
    check.innerHTML = "";
    card.style.borderColor = "var(--line)";
  }
}

window.addEventListener("DOMContentLoaded", function () {
  renderLoginCaptchaBox();
});

async function handleLogin(event) {
  event.preventDefault();
  if (!loginCaptchaVerified) {
    showAlert("Security Verification", "Please check the 'I'm not a robot' security box before signing in.", "warn");
    return;
  }

  var email = document.getElementById("email").value.trim();
  var password = document.getElementById("password").value;
  var btn = document.getElementById("btn-login");

  btn.disabled = true;
  var oldText = btn.textContent;
  btn.textContent = "Signing in...";

  try {
    var user = await dbSignIn(email, password);
    window.location.href = getHomeForRole(user.role);
  } catch (err) {
    showAlert("Sign In Failed", err.message || "Invalid email or password.", "bad");
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

// Step 1 of Forgot Password: enter email address to receive 6-digit reset code
function openForgotModal() {
  openPopup(
    '<h3>Reset Your Password</h3>' +
    '<p class="small muted mt">Enter your account email address. We will send a 6-digit verification code to reset your password.</p>' +
    '<div class="mt">' +
      '<label for="reset-email">Email Address</label>' +
      '<input id="reset-email" type="email" placeholder="yourname@gmail.com">' +
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
      "We received a request to reset the password associated with your PIGEM Combined Facilities Support Services account (" + email + ").\n\n" +
      "Your 6-Digit Password Reset Verification Code is: " + code + "\n\n" +
      "Please enter this verification code on the password reset screen to set your new password. If you did not request a password reset, please disregard this notice.\n\n" +
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
    showAlert("Password Updated", "Your password has been changed. You can now sign in with your new password.", "good");
  } catch (err) {
    showAlert("Reset Failed", err.message || "Invalid code or password.", "bad");
  }
}
