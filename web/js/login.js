// ============================================================
// LOGIN PAGE LOGIC (Customer, Staff, and Admin Login)
// ============================================================

var resetEmailPending = "";

window.addEventListener("DOMContentLoaded", function () {
  // Hide splash screen after 650ms if present
  var splash = document.getElementById("splash");
  if (splash) {
    setTimeout(function () {
      splash.classList.add("hide");
    }, 650);
  }

  // Pre-fill email if passed via ?email=
  var params = new URLSearchParams(window.location.search);
  var emailParam = params.get("email");
  if (emailParam && document.getElementById("login-email")) {
    document.getElementById("login-email").value = emailParam;
  }
});

function showBox(which) {
  var loginBox = document.getElementById("box-login");
  var resetBox = document.getElementById("box-reset");
  var regBox = document.getElementById("box-register");
  if (loginBox) loginBox.classList.toggle("hidden", which !== "login");
  if (resetBox) resetBox.classList.toggle("hidden", which !== "reset");
  if (regBox) regBox.classList.toggle("hidden", which !== "register");
}

function goToRoleDashboard(role) {
  if (role === "customer") window.location.href = "customer.html";
  else if (role === "agent") window.location.href = "agent.html";
  else if (role === "manager") window.location.href = "manager.html";
  else if (role === "admin") window.location.href = "admin.html";
  else window.location.href = "index.html";
}

async function handleSignIn(event) {
  event.preventDefault();
  hideMsg("login-msg");

  var email = document.getElementById("login-email").value.trim();
  var password = document.getElementById("login-password").value;
  var btn = document.getElementById("btn-login");
  var oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Signing in...";

  try {
    var user = await dbSignIn(email, password);
    goToRoleDashboard(user.role);
  } catch (err) {
    showMsg("login-msg", "error", err.message || "Unable to sign in.");
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

// Register an official Staff (Agent/Manager) or Admin Gmail account directly into Supabase
async function handleStaffRegister(event) {
  event.preventDefault();
  hideMsg("reg-msg");

  var fullName = document.getElementById("reg-name").value.trim();
  var email = document.getElementById("reg-email").value.trim().toLowerCase();
  var password = document.getElementById("reg-password").value;
  var role = document.getElementById("reg-role").value;
  var btn = document.getElementById("btn-reg");
  var oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Creating Account...";

  try {
    await dbCreateUserAccount(fullName, email, password, role);
    var user = await dbSignIn(email, password);
    goToRoleDashboard(user.role);
  } catch (err) {
    showMsg("reg-msg", "error", err.message || "Could not create account.");
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

async function sendResetCode() {
  hideMsg("reset-msg");
  var email = document.getElementById("reset-email").value.trim().toLowerCase();
  if (!email) {
    showMsg("reset-msg", "error", "Please enter your email address.");
    return;
  }
  try {
    var code = await dbStartPasswordReset(email);
    resetEmailPending = email;
    await apiSendOtpEmail(email, code, "Password Reset Code");
    document.getElementById("reset-step-1").classList.add("hidden");
    document.getElementById("reset-step-2").classList.remove("hidden");
    showMsg("reset-msg", "info", "A 6-digit verification code has been sent to " + email + ".");
  } catch (err) {
    showMsg("reset-msg", "error", err.message || "Could not send code.");
  }
}

async function confirmPasswordReset() {
  hideMsg("reset-msg");
  var code = document.getElementById("reset-code").value.trim();
  var newPw = document.getElementById("reset-new-pw").value;
  try {
    await dbFinishPasswordReset(resetEmailPending, code, newPw);
    showBox("login");
    document.getElementById("login-email").value = resetEmailPending;
    showMsg("login-msg", "ok", "Password updated! You can now sign in with your new password.");
  } catch (err) {
    showMsg("reset-msg", "error", err.message || "Could not reset password.");
  }
}
