// ============================================================
// SUPABASE: LOGIN, DATABASE, AND FILE STORAGE
// Demo Mode (no Supabase keys) saves everything in browser storage.
// ============================================================

// MAJOR: Which system is this page part of?
//   "customer" = public website + customer account
//   "staff"    = Application Management System (agents and manager)
//   "admin"    = Technical Management System
var SYSTEM = window.SYSTEM || "customer";

// Roles allowed to sign in to each system
var SYSTEM_ROLES = {
  customer: ["customer"],
  staff: ["agent", "manager"],
  admin: ["admin"]
};

// MAJOR: Each system keeps its own login session so they never mix.
// Staff and admin use sessionStorage (one session per browser tab), so two agents,
// or an agent and the manager, can work in different tabs without replacing each other.
var SESSION_KEY = "pigem_session_" + SYSTEM;
var sessionStore = SYSTEM === "customer" ? localStorage : sessionStorage;

var IS_DEMO_MODE = (CONFIG.SUPABASE_URL === "" || CONFIG.SUPABASE_ANON_KEY === "");
var supabaseClient = null;

if (!IS_DEMO_MODE && window.supabase) {
  // MAJOR: Connect to Supabase with a separate saved session for each system
  supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { storageKey: "pigem-" + SYSTEM, storage: sessionStore }
  });
}

// Demo accounts (password: demo123)
var DEFAULT_DEMO_USERS = [
  { id: "demo-customer", email: "customer@demo.test", password: "demo123", full_name: "Juan Dela Cruz", role: "customer", active: true, activated: true },
  { id: "demo-agent", email: "agent@demo.test", password: "demo123", full_name: "Alex Rivera", role: "agent", active: true, activated: true },
  { id: "demo-agent2", email: "agent2@demo.test", password: "demo123", full_name: "Bea Santos", role: "agent", active: true, activated: true },
  { id: "demo-manager", email: "manager@demo.test", password: "demo123", full_name: "Maya Reyes", role: "manager", active: true, activated: true },
  { id: "demo-admin", email: "admin@demo.test", password: "demo123", full_name: "System Admin", role: "admin", active: true, activated: true }
];

function getDemoUsers() {
  var users = readSaved("pigem_users", null);
  if (!users) {
    writeSaved("pigem_users", DEFAULT_DEMO_USERS);
    return DEFAULT_DEMO_USERS;
  }
  return users;
}

function findDemoUserByEmail(email) {
  var users = getDemoUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email) return users[i];
  }
  return null;
}

// Address of the login page for this system
function getLoginPage() {
  if (SYSTEM === "staff") return ROOT + "staff-login.html";
  if (SYSTEM === "admin") return ROOT + "admin-login.html";
  return ROOT + "login.html";
}

// ============================================================
// 1. Login and accounts
// ============================================================

// MAJOR: Get the user signed in to THIS system
async function dbGetCurrentUser() {
  // Check tab/system session first (works for built-in staff/demo accounts and local sessions)
  var currentId = sessionStore.getItem(SESSION_KEY);
  if (currentId) {
    var localUsers = getDemoUsers();
    for (var i = 0; i < localUsers.length; i++) {
      if (localUsers[i].id === currentId && localUsers[i].active) return localUsers[i];
    }
    if (!IS_DEMO_MODE) {
      var dbUser = await supabaseClient.from("users").select("*").eq("id", currentId).maybeSingle();
      if (dbUser.data && dbUser.data.active) return dbUser.data;
    }
  }

  if (IS_DEMO_MODE) return null;

  var sessionRes = await supabaseClient.auth.getSession();
  var session = sessionRes.data.session;
  if (!session) return null;

  // MAJOR: Read the role from the "users" table (create a customer row on first login)
  var authUser = session.user;
  var res = await supabaseClient.from("users").select("*").eq("email", authUser.email).maybeSingle();
  if (!res.data) {
    var row = {
      id: authUser.id,
      email: authUser.email,
      full_name: (authUser.user_metadata && authUser.user_metadata.full_name) || authUser.email,
      role: "customer",
      active: true,
      activated: true
    };
    await supabaseClient.from("users").upsert(row, { onConflict: "email" });
    return row;
  }
  if (!res.data.active) return null;
  return res.data;
}

// MAJOR: Sign in. The account role must belong to this system.
async function dbSignIn(email, password) {
  var cleanEmail = email.trim().toLowerCase();
  var user = null;

  // 1. Check built-in/local accounts first (so Agent, Manager, Admin, and Demo accounts always work)
  var found = findDemoUserByEmail(cleanEmail);
  if (found && found.password === password) {
    if (found.role === "customer" && !found.activated) {
      throw new Error("Please activate your account first using the link sent to your email.");
    }
    if (!found.active) throw new Error("This account is disabled. Please contact PIGEM.");
    user = found;
    if (!IS_DEMO_MODE) {
      await supabaseClient.from("users").upsert({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        active: user.active,
        activated: true
      }, { onConflict: "email" });
    }
  } else if (!IS_DEMO_MODE) {
    // 2. Otherwise sign in via Supabase Authentication
    var res = await supabaseClient.auth.signInWithPassword({ email: cleanEmail, password: password });
    if (res.error) throw new Error(res.error.message);
    user = await dbGetCurrentUser();
    if (!user) throw new Error("This account is disabled. Please contact PIGEM.");
  } else {
    throw new Error("Wrong email or password.");
  }

  if (SYSTEM_ROLES[SYSTEM].indexOf(user.role) === -1) {
    if (!IS_DEMO_MODE) await supabaseClient.auth.signOut();
    throw new Error("This account cannot sign in here.");
  }

  sessionStore.setItem(SESSION_KEY, user.id);
  await dbAddLoginHistory(user, "login");
  return user;
}

// MAJOR: Sign out of this system only
async function dbSignOut() {
  var user = await dbGetCurrentUser();
  if (user) await dbAddLoginHistory(user, "logout");
  sessionStore.removeItem(SESSION_KEY);
  if (!IS_DEMO_MODE) {
    await supabaseClient.auth.signOut();
  }
}

// MAJOR: Send a password reset email (Supabase Authentication)
async function dbResetPassword(email) {
  if (IS_DEMO_MODE) return;
  var res = await supabaseClient.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (res.error) throw new Error(res.error.message);
}

// MAJOR: Token sent to the Python server so it knows who is calling
async function dbGetToken() {
  if (IS_DEMO_MODE) return "";
  var res = await supabaseClient.auth.getSession();
  return res.data.session ? res.data.session.access_token : "";
}

// Stop the page if the signed-in user does not have the right role
async function checkPageAccess(allowedRoles) {
  if (typeof allowedRoles === "string") allowedRoles = [allowedRoles];
  var user = await dbGetCurrentUser();
  if (!user || allowedRoles.indexOf(user.role) === -1) {
    window.location.href = getLoginPage();
    return null;
  }
  return user;
}

// MAJOR: Create a customer account when an application is submitted.
// Returns status "new" (activation email sent), "pending" (not yet activated, email sent again),
// or "active" (already has an account, just log in).
async function dbCreateAccountFromApplication(fullName, email) {
  var cleanEmail = email.trim().toLowerCase();
  var code = String(Math.floor(100000 + Math.random() * 900000));

  if (IS_DEMO_MODE) {
    var users = getDemoUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].email === cleanEmail) {
        if (users[i].activated) return { user: users[i], status: "active", code: "" };
        users[i].activation_code = code;
        writeSaved("pigem_users", users);
        return { user: users[i], status: "pending", code: code };
      }
    }
    var newUser = {
      id: "cust-" + Date.now(),
      email: cleanEmail,
      password: "",
      full_name: fullName,
      role: "customer",
      active: true,
      activated: false,
      activation_code: code
    };
    users.push(newUser);
    writeSaved("pigem_users", users);
    return { user: newUser, status: "new", code: code };
  }

  // Live mode: if the email already has an activated account, do not send activation again
  var existing = await supabaseClient.from("users").select("*").eq("email", cleanEmail).maybeSingle();
  if (existing.data && existing.data.activated) {
    return { user: existing.data, status: "active", code: "" };
  }

  // Save pending customer row with 6-digit activation_code (emailed via Resend by apply.js)
  var pendingRow = {
    id: (existing.data && existing.data.id) || ("cust-" + Date.now()),
    email: cleanEmail,
    full_name: fullName,
    role: "customer",
    active: true,
    activated: false,
    activation_code: code
  };
  await supabaseClient.from("users").upsert(pendingRow, { onConflict: "email" });
  return { user: pendingRow, status: "new", code: code };
}

// MAJOR: Activate a customer account ONE time (code from email + new password)
async function dbActivateCustomerAccount(email, code, newPassword) {
  var cleanEmail = email.trim().toLowerCase();

  if (IS_DEMO_MODE) {
    var users = getDemoUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].email === cleanEmail) {
        if (users[i].activated) throw new Error("This account is already activated. Please log in.");
        if (users[i].activation_code !== code.trim()) throw new Error("The activation code is not correct.");
        users[i].password = newPassword;
        users[i].activated = true;
        users[i].activation_code = "";
        writeSaved("pigem_users", users);
        sessionStore.setItem(SESSION_KEY, users[i].id);
        await dbAddLoginHistory(users[i], "account_activated");
        return users[i];
      }
    }
    throw new Error("No application was found for this email.");
  }

  // Live Supabase mode: check activation_code in public.users, then register in Supabase Auth
  var existing = await supabaseClient.from("users").select("*").eq("email", cleanEmail).maybeSingle();
  if (!existing.data) throw new Error("No application was found for this email.");
  if (existing.data.activated) throw new Error("This account is already activated. Please log in.");
  if (String(existing.data.activation_code || "").trim() !== code.trim()) {
    throw new Error("The 6-digit activation code is not correct.");
  }

  var signUpRes = await supabaseClient.auth.signUp({
    email: cleanEmail,
    password: newPassword,
    options: { data: { full_name: existing.data.full_name } }
  });
  if (signUpRes.error && signUpRes.error.message.toLowerCase().indexOf("already registered") === -1) {
    throw new Error(signUpRes.error.message);
  }

  var authUserId = (signUpRes.data && signUpRes.data.user && signUpRes.data.user.id) || existing.data.id;
  await supabaseClient.from("users").update({
    id: authUserId,
    activated: true,
    activation_code: ""
  }).eq("email", cleanEmail);

  await supabaseClient.auth.signInWithPassword({ email: cleanEmail, password: newPassword });
  var user = await dbGetCurrentUser();
  if (user) await dbAddLoginHistory(user, "account_activated");
  return user || existing.data;
}

// Check if an email already activated its account (used by activate.html)
async function dbIsAccountActivated(email) {
  var cleanEmail = String(email || "").trim().toLowerCase();
  if (IS_DEMO_MODE) {
    var u = findDemoUserByEmail(cleanEmail);
    return Boolean(u && u.activated);
  }
  var res = await supabaseClient.from("users").select("activated").eq("email", cleanEmail).maybeSingle();
  return Boolean(res.data && res.data.activated);
}

// MAJOR: Manager creates an agent account
async function dbCreateAgentAccount(fullName, email, password) {
  var cleanEmail = email.trim().toLowerCase();

  if (IS_DEMO_MODE) {
    if (findDemoUserByEmail(cleanEmail)) throw new Error("This email is already used.");
    var users = getDemoUsers();
    var agent = { id: "agent-" + Date.now(), email: cleanEmail, password: password, full_name: fullName, role: "agent", active: true, activated: true };
    users.push(agent);
    writeSaved("pigem_users", users);
    await dbAddActivity("agent_created", fullName + " (" + cleanEmail + ")");
    return agent;
  }

  var res = await supabaseClient.auth.signUp({ email: cleanEmail, password: password, options: { data: { full_name: fullName } } });
  if (res.error) throw new Error(res.error.message);
  var row = { id: res.data.user.id, email: cleanEmail, full_name: fullName, role: "agent", active: true, activated: true };
  await supabaseClient.from("users").upsert(row);
  await dbAddActivity("agent_created", fullName + " (" + cleanEmail + ")");
  return row;
}

// Update the signed-in user's own profile (name, photo, intro)
async function dbUpdateMyProfile(userId, changes) {
  return await dbUpdateProfile(userId, changes);
}

// ============================================================
// 2. login_history table
// ============================================================

async function dbAddLoginHistory(user, action) {
  var row = { user_id: user.id, email: user.email, role: user.role, action: action, created_at: new Date().toISOString() };
  if (IS_DEMO_MODE) {
    var list = readSaved("pigem_login_history", []);
    list.unshift(row);
    writeSaved("pigem_login_history", list.slice(0, 300));
    return;
  }
  await supabaseClient.from("login_history").insert(row);
}

async function dbListLoginHistory() {
  if (IS_DEMO_MODE) return readSaved("pigem_login_history", []);
  var res = await supabaseClient.from("login_history").select("*").order("created_at", { ascending: false }).limit(200);
  return res.data || [];
}

// ============================================================
// 3. applications table
// ============================================================

// MAJOR: Customers only see their own applications (matched by email). Staff see all.
async function dbListApplications(user) {
  if (IS_DEMO_MODE) {
    var all = readSaved("pigem_applications", []);
    if (user && user.role === "customer") {
      return all.filter(function (a) { return a.email === user.email; });
    }
    return all;
  }
  var query = supabaseClient.from("applications").select("*").order("created_at", { ascending: false });
  if (user && user.role === "customer") query = query.eq("email", user.email);
  var res = await query;
  if (res.error) throw new Error(res.error.message);
  return res.data || [];
}

async function dbGetApplication(appId) {
  if (IS_DEMO_MODE) {
    var all = readSaved("pigem_applications", []);
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === appId) return all[i];
    }
    return null;
  }
  var res = await supabaseClient.from("applications").select("*").eq("id", appId).maybeSingle();
  return res.data;
}

// MAJOR: Save a new application. A copy of what the customer first sent is kept in original_copy.
async function dbCreateApplication(appData) {
  var now = new Date().toISOString();
  var refNo = "PIGEM-" + String(Date.now()).slice(-6) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

  var row = Object.assign({}, appData, {
    ref_no: refNo,
    status: "Processing",
    original_copy: Object.assign({}, appData),
    corrected_copy: null,
    ai_log: [{ at: now, who: "System", text: "Application received." }],
    customer_instruction: getDefaultStatusInstruction("Processing", ""),
    created_at: now,
    updated_at: now
  });

  if (IS_DEMO_MODE) {
    row.id = "app-" + Date.now();
    var all = readSaved("pigem_applications", []);
    all.unshift(row);
    writeSaved("pigem_applications", all);
    return row;
  }
  var res = await supabaseClient.from("applications").insert(row).select("*").single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// MAJOR: Update an application (claim, status, correction, encoding, provider result)
async function dbUpdateApplication(appId, changes) {
  changes.updated_at = new Date().toISOString();
  if (IS_DEMO_MODE) {
    var all = readSaved("pigem_applications", []);
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === appId) {
        all[i] = Object.assign({}, all[i], changes);
        writeSaved("pigem_applications", all);
        return all[i];
      }
    }
    throw new Error("Application not found.");
  }
  var res = await supabaseClient.from("applications").update(changes).eq("id", appId).select("*").single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// Add one line to the AI activity of an application (shown to agents like a chat)
async function dbAddAiLog(appId, who, text) {
  var app = await dbGetApplication(appId);
  if (!app) return;
  var log = app.ai_log || [];
  log.push({ at: new Date().toISOString(), who: who, text: text });
  await dbUpdateApplication(appId, { ai_log: log });
}

// ============================================================
// 4. File storage (documents bucket)
// ============================================================

// MAJOR: Upload an ID picture or encoding screenshot
async function dbUploadDocument(file, folder, label) {
  if (!file) return null;
  if (IS_DEMO_MODE) {
    return await new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  var ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  var path = (folder || "ids") + "/" + Date.now() + "-" + label + "." + ext;
  var res = await supabaseClient.storage.from("documents").upload(path, file);
  if (res.error) throw new Error(res.error.message);
  return CONFIG.SUPABASE_URL.replace(/\/$/, "") + "/storage/v1/object/public/documents/" + path;
}

// MAJOR: Get a short-lived link to view a private file
async function dbGetDocumentLink(path) {
  if (!path) return null;
  if (path.indexOf("data:") === 0 || path.indexOf("http") === 0 || IS_DEMO_MODE) return path;
  var res = await supabaseClient.storage.from("documents").createSignedUrl(path, 600);
  return res.error ? null : res.data.signedUrl;
}

// ============================================================
// 5. notifications and system_logs tables
// ============================================================

// MAJOR: Save a notification. Send to one person (user_id / email) or to everyone with a role (role: "agent").
async function dbAddNotification(note) {
  var row = {
    user_id: note.user_id || null,
    email: note.email || null,
    role: note.role || null,
    subject: note.subject,
    body: note.body,
    is_read: false,
    created_at: new Date().toISOString()
  };
  if (IS_DEMO_MODE) {
    row.id = Date.now() + Math.floor(Math.random() * 1000);
    var all = readSaved("pigem_notifications", []);
    all.unshift(row);
    writeSaved("pigem_notifications", all.slice(0, 300));
    return row;
  }
  await supabaseClient.from("notifications").insert(row);
}

async function dbListMyNotifications(user) {
  if (IS_DEMO_MODE) {
    return readSaved("pigem_notifications", []).filter(function (n) {
      return n.user_id === user.id || n.email === user.email || n.role === user.role;
    });
  }
  var res = await supabaseClient.from("notifications").select("*")
    .or("user_id.eq." + user.id + ",email.eq." + user.email + ",role.eq." + user.role)
    .order("created_at", { ascending: false }).limit(50);
  return res.data || [];
}

async function dbAddActivity(action, detail) {
  var user = await dbGetCurrentUser();
  var row = { actor_email: user ? user.email : "public", action: action, detail: String(detail || ""), created_at: new Date().toISOString() };
  if (IS_DEMO_MODE) {
    var all = readSaved("pigem_activity", []);
    all.unshift(row);
    writeSaved("pigem_activity", all.slice(0, 300));
    return;
  }
  await supabaseClient.from("system_logs").insert(row);
}

async function dbListActivity() {
  if (IS_DEMO_MODE) return readSaved("pigem_activity", []);
  var res = await supabaseClient.from("system_logs").select("*").order("created_at", { ascending: false }).limit(200);
  return res.data || [];
}

// ============================================================
// 6. users table
// ============================================================

async function dbListProfiles() {
  if (IS_DEMO_MODE) return getDemoUsers();
  var res = await supabaseClient.from("users").select("*").order("created_at", { ascending: false });
  return res.data || [];
}

async function dbUpdateProfile(userId, changes) {
  if (IS_DEMO_MODE) {
    var users = getDemoUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === userId) {
        users[i] = Object.assign({}, users[i], changes);
        writeSaved("pigem_users", users);
        return users[i];
      }
    }
    return null;
  }
  var res = await supabaseClient.from("users").update(changes).eq("id", userId).select("*").single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// Clear all Demo Mode records
function dbResetDemoData() {
  var keys = ["pigem_users", "pigem_applications", "pigem_notifications", "pigem_activity", "pigem_login_history",
    "pigem_plans", "pigem_website_content", "pigem_system_settings", "pigem_session_customer"];
  for (var i = 0; i < keys.length; i++) localStorage.removeItem(keys[i]);
  sessionStorage.clear();
}


// ============================================================
// 7. Convenience helpers & Demo Seed Data for Dashboards
// ============================================================

var DEFAULT_DEMO_APPS = [
  {
    id: "app-demo-1",
    ref_no: "PIGEM-842190-A1B2",
    reference_no: "PIGEM-842190-A1B2",
    plan_id: "1400",
    plan_name: "Plan 1400 (300 Mbps - ₱1,400/mo)",
    first_name: "Juan",
    middle_name: "Santos",
    last_name: "Dela Cruz",
    full_name: "Juan Santos Dela Cruz",
    email: "customer@demo.test",
    birth_date: "1995-04-12",
    phone: "09171234567",
    id_type: "Philippine Driver's License",
    id_number: "N01-23-456789",
    id_image_url: "assets/images/logo.png",
    building_name: "Greenwoods Subd.",
    street: "Blk 4 Lot 12 Sampaguita St.",
    subdivision: "Greenwoods Executive",
    barangay: "Salitran II",
    city: "Dasmariñas City",
    province: "Cavite",
    landmark: "Near Salitran Elementary School",
    latitude: 14.3294,
    longitude: 120.9367,
    status: "Pending Review",
    assigned_agent: "",
    encoded: false,
    has_correction: false,
    ai_result: {
      overall_status: "Verified",
      blur_score: 142.5,
      name_match: true,
      id_number_match: true,
      issues: []
    },
    ai_log: [
      { at: new Date(Date.now() - 7200000).toISOString(), who: "AI Screening Engine", text: "OpenCV & PaddleOCR check passed: ID is sharp (blur score 142.5) and name/ID number match." }
    ],
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: "app-demo-2",
    ref_no: "PIGEM-739104-C3D4",
    reference_no: "PIGEM-739104-C3D4",
    plan_id: "1000",
    plan_name: "Plan 1000 (100 Mbps - ₱1,000/mo)",
    first_name: "Maria",
    middle_name: "L.",
    last_name: "Reyes",
    full_name: "Maria L. Reyes",
    email: "customer@demo.test",
    birth_date: "1998-09-21",
    phone: "09189876543",
    id_type: "National ID",
    id_number: "1234-5678-9012-3456",
    id_image_url: "assets/images/logo.png",
    building_name: "Villa Luisa",
    street: "24 Mabini St.",
    subdivision: "Villa Luisa Homes",
    barangay: "Zone IV",
    city: "Dasmariñas City",
    province: "Cavite",
    landmark: "Beside Barangay Hall",
    latitude: 14.3270,
    longitude: 120.9380,
    status: "Needs Correction",
    assigned_agent: "agent@demo.test",
    agent_remarks: "Please upload a clearer photo of your National ID (glare on the ID number).",
    encoded: false,
    has_correction: false,
    ai_result: {
      overall_status: "Needs Review",
      blur_score: 48.2,
      name_match: true,
      id_number_match: false,
      issues: ["Slight glare detected on ID number area"]
    },
    ai_log: [
      { at: new Date(Date.now() - 18000000).toISOString(), who: "AI Screening Engine", text: "Flagged slight glare on ID number area (blur score 48.2)." },
      { at: new Date(Date.now() - 14400000).toISOString(), who: "Agent (Alex Rivera)", text: "Requested clearer ID photo from customer." }
    ],
    created_at: new Date(Date.now() - 18000000).toISOString(),
    updated_at: new Date(Date.now() - 14400000).toISOString()
  },
  {
    id: "app-demo-3",
    ref_no: "PIGEM-615022-E5F6",
    reference_no: "PIGEM-615022-E5F6",
    plan_id: "1900",
    plan_name: "Plan 1900 (500 Mbps - ₱1,900/mo)",
    first_name: "Carlo",
    middle_name: "M.",
    last_name: "Bautista",
    full_name: "Carlo M. Bautista",
    email: "carlo@demo.test",
    birth_date: "1990-01-15",
    phone: "09223334455",
    id_type: "Philippine Passport",
    id_number: "P1234567A",
    id_image_url: "assets/images/logo.png",
    building_name: "St. Charbel",
    street: "88 Aguinaldo Hwy",
    subdivision: "St. Charbel South",
    barangay: "Sampaloc I",
    city: "Dasmariñas City",
    province: "Cavite",
    landmark: "Across Robinsons Place Dasmariñas",
    latitude: 14.3035,
    longitude: 120.9560,
    status: "Approved",
    assigned_agent: "agent@demo.test",
    agent_remarks: "Application verified and encoded. Please wait 3–5 business days for installation dispatch.",
    encoded: true,
    has_correction: true,
    original_submission: {
      full_name: "Carlo Bautista",
      phone: "09220001111",
      id_type: "Philippine Passport",
      id_number: "P1234567",
      street: "Aguinaldo Hwy",
      id_image_url: "assets/images/logo.png"
    },
    ai_result: {
      overall_status: "Verified",
      blur_score: 165.0,
      name_match: true,
      id_number_match: true,
      issues: []
    },
    ai_log: [
      { at: new Date(Date.now() - 86400000).toISOString(), who: "Customer (Carlo M. Bautista)", text: "Resubmitted corrected passport number P1234567A." },
      { at: new Date(Date.now() - 82800000).toISOString(), who: "Agent (Alex Rivera)", text: "Verified corrected copy and encoded to Red Fiber provider." }
    ],
    created_at: new Date(Date.now() - 90000000).toISOString(),
    updated_at: new Date(Date.now() - 82800000).toISOString()
  }
];

function normalizeAppRecord(a) {
  if (!a) return a;
  if (!a.reference_no && a.ref_no) a.reference_no = a.ref_no;
  if (!a.ref_no && a.reference_no) a.ref_no = a.reference_no;
  if (!a.plan_id && a.plan) a.plan_id = a.plan;
  if (!a.plan_name && a.plan_id) {
    var p = getPlanById(a.plan_id);
    a.plan_name = p.name + " (" + p.speed + " Mbps - ₱" + p.price + "/mo)";
  }
  if (!a.full_name) {
    a.full_name = ((a.first_name || "") + " " + (a.middle_name ? a.middle_name + " " : "") + (a.last_name || "")).trim() || a.email || "Applicant";
  }
  if (!a.phone && a.mobile_primary) a.phone = a.mobile_primary;
  if (!a.id_image_url) a.id_image_url = a.id_front_path || a.id_front_url || "";
  if (a.latitude == null && a.lat != null) a.latitude = a.lat;
  if (a.longitude == null && a.lng != null) a.longitude = a.lng;
  if (!a.ai_result && a.screening) {
    var q = a.screening.quality || {};
    var ai = a.screening.ai || {};
    a.ai_result = {
      overall_status: (q.issues && q.issues.length > 0) ? "Needs Review" : "Verified",
      blur_score: q.blur_score || q.sharpness || "OK",
      name_match: true,
      id_number_match: true,
      issues: (ai.findings && ai.findings.length) ? ai.findings : (q.issues || [])
    };
  }
  if (!a.original_submission && a.original_copy) a.original_submission = a.original_copy;
  if (!a.correction_fields && a.screening && a.screening.correction_fields) {
    a.correction_fields = a.screening.correction_fields;
  }
  if (!a.validator_raw_remark && a.screening && a.screening.validator_raw_remark) {
    a.validator_raw_remark = a.screening.validator_raw_remark;
  }
  if (!a.agent_remarks && (a.correction_note || a.customer_instruction)) {
    a.agent_remarks = a.correction_note || a.customer_instruction;
  }
  if (a.status === "Processing") a.status = "Pending Review";
  return a;
}

function ensureDemoSeedApps() {
  var apps = readSaved("pigem_applications", null);
  if (!apps || apps.length === 0) {
    writeSaved("pigem_applications", DEFAULT_DEMO_APPS);
    return DEFAULT_DEMO_APPS.slice();
  }
  for (var i = 0; i < apps.length; i++) normalizeAppRecord(apps[i]);
  return apps;
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showMsg(id, type, text) {
  var el = document.getElementById(id);
  if (!el) return;
  el.className = "msg show " + (type || "info");
  el.textContent = text;
}

function hideMsg(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.className = "msg";
  el.textContent = "";
}

function statusBadge(status) {
  var st = status || "Pending Review";
  var cls = "badge-gray";
  if (st === "Approved" || st === "Submitted to Provider") cls = "badge-green";
  else if (st === "Needs Correction") cls = "badge-yellow";
  else if (st === "Rejected") cls = "badge-red";
  else if (st === "Under Agent Review" || st === "Pending Review" || st === "Processing") cls = "badge-blue";
  return '<span class="badge ' + cls + '">' + escapeHtml(st) + '</span>';
}

function isAiEnabled() {
  return Boolean(getSystemSettings().ai_enabled);
}

function setAiEnabled(val) {
  var s = getSystemSettings();
  s.ai_enabled = Boolean(val);
  saveSystemSettings(s);
}

function isMaintenanceOn() {
  return Boolean(getSystemSettings().maintenance_mode);
}

function setMaintenanceOn(val) {
  var s = getSystemSettings();
  s.maintenance_mode = Boolean(val);
  saveSystemSettings(s);
}

function getSiteContent() {
  var wc = getWebsiteContent();
  var plans = getActivePlans();
  return {
    logo_image: wc.logo_image || DEFAULT_CONTENT.logo_image || "logo.png",
    home_slides: wc.hero_slides || DEFAULT_CONTENT.hero_slides,
    about_slides: wc.about_slides || DEFAULT_CONTENT.about_slides,
    client_images: wc.client_images || DEFAULT_CONTENT.client_images,
    vehicle_images: wc.vehicle_images || DEFAULT_CONTENT.vehicle_images,
    permit_images: wc.permit_images || DEFAULT_CONTENT.permit_images,
    asset_library: wc.asset_library || DEFAULT_CONTENT.asset_library,
    about_lead: (wc.about && wc.about.mission) || DEFAULT_CONTENT.about.mission,
    about_story_1: (wc.about && wc.about.story) || DEFAULT_CONTENT.about.story,
    about_story_2: (wc.about && wc.about.story2) || DEFAULT_CONTENT.about.story2,
    contact_email: wc.contact_email || "support@pigem.com",
    contact_phone: wc.contact_phone || "101-733 (RED) / (02) 8899-9733",
    contact_address: wc.contact_address || "Dasmariñas City, Cavite",
    plans: plans.map(function (p) {
      return {
        id: p.id,
        name: p.name,
        speed: String(p.speed).indexOf("Mbps") !== -1 ? p.speed : (p.speed + " Mbps"),
        price: p.price,
        features: p.features || CONFIG.PLAN_INCLUSIONS
      };
    }),
    faqs: wc.faqs || DEFAULT_CONTENT.faqs
  };
}

function saveSiteContent(c) {
  var wc = getWebsiteContent();
  if (c.logo_image) wc.logo_image = c.logo_image;
  if (c.home_slides) wc.hero_slides = c.home_slides;
  if (c.about_slides) wc.about_slides = c.about_slides;
  if (c.client_images) wc.client_images = c.client_images;
  if (c.vehicle_images) wc.vehicle_images = c.vehicle_images;
  if (c.permit_images) wc.permit_images = c.permit_images;
  if (c.asset_library) wc.asset_library = c.asset_library;
  wc.about = wc.about || {};
  if (c.about_lead != null) wc.about.mission = c.about_lead;
  if (c.about_story_1 != null) wc.about.story = c.about_story_1;
  if (c.about_story_2 != null) wc.about.story2 = c.about_story_2;
  if (c.contact_email != null) wc.contact_email = c.contact_email;
  if (c.contact_phone != null) wc.contact_phone = c.contact_phone;
  if (c.contact_address != null) wc.contact_address = c.contact_address;
  if (c.faqs) wc.faqs = c.faqs;
  saveWebsiteContent(wc);

  if (c.plans) {
    var mapped = c.plans.map(function (p, idx) {
      var numSpeed = parseInt(String(p.speed).replace(/[^0-9]/g, ""), 10) || 100;
      return {
        id: p.id || String(p.price || (idx === 0 ? "1000" : idx === 1 ? "1400" : "1900")),
        name: p.name,
        speed: numSpeed,
        price: p.price,
        tag: idx === 1 ? "Most chosen" : "Fiber for your home",
        featured: idx === 1,
        features: p.features
      };
    });
    saveActivePlans(mapped);
  }
}

async function requireLogin(roles) {
  return await checkPageAccess(roles);
}

async function signOutAndGoLogin() {
  var page = getLoginPage();
  await dbSignOut();
  window.location.href = page;
}

async function dbStartPasswordReset(email) {
  var clean = String(email || "").trim().toLowerCase();
  var code = String(Math.floor(100000 + Math.random() * 900000));
  var users = getDemoUsers();
  var found = false;
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === clean) {
      users[i].reset_code = code;
      found = true;
      break;
    }
  }
  if (!found) throw new Error("No account found with that email address.");
  writeSaved("pigem_users", users);
  return code;
}

async function dbFinishPasswordReset(email, code, newPw) {
  if (!newPw || newPw.length < 6) throw new Error("Password must be at least 6 characters.");
  var clean = String(email || "").trim().toLowerCase();
  var users = getDemoUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === clean) {
      if (users[i].reset_code !== String(code).trim()) {
        throw new Error("Invalid 6-digit verification code.");
      }
      users[i].password = newPw;
      users[i].reset_code = "";
      writeSaved("pigem_users", users);
      return true;
    }
  }
  throw new Error("Account not found.");
}

async function dbListAllApplications() {
  if (IS_DEMO_MODE) {
    return ensureDemoSeedApps();
  }
  var list = await dbListApplications(null);
  return list.map(normalizeAppRecord);
}

async function dbListApplicationsForCustomer(email) {
  var all = await dbListAllApplications();
  var clean = String(email || "").trim().toLowerCase();
  return all.filter(function (a) { return String(a.email || "").toLowerCase() === clean; });
}

async function dbUploadIdPhoto(file, label) {
  return await dbUploadDocument(file, "ids", label || "id");
}

async function dbListNotifications(email, role) {
  var u = await dbGetCurrentUser();
  var list = await dbListMyNotifications(u || { id: "", email: email, role: role });
  return list.map(function (n) {
    return {
      id: n.id,
      title: n.title || n.subject || "Notification",
      message: n.message || n.body || "",
      created_at: n.created_at
    };
  });
}

var _origDbAddNotification = dbAddNotification;
dbAddNotification = async function (arg1, arg2, arg3, arg4) {
  if (typeof arg1 === "object" && arg1 !== null) {
    return await _origDbAddNotification(arg1);
  }
  return await _origDbAddNotification({
    email: arg1,
    role: arg2,
    subject: arg3,
    body: arg4
  });
};

var _origDbAddAiLog = dbAddAiLog;
dbAddAiLog = async function (appId, arg2, arg3, arg4) {
  var who = arg4 !== undefined ? arg3 : arg2;
  var text = arg4 !== undefined ? arg4 : arg3;
  var refNo = arg4 !== undefined ? arg2 : "";
  await _origDbAddAiLog(appId, who, text);
  var globalAi = readSaved("pigem_ai_logs", []);
  globalAi.unshift({
    app_id: appId,
    reference_no: refNo,
    actor: who,
    message: text,
    created_at: new Date().toISOString()
  });
  writeSaved("pigem_ai_logs", globalAi.slice(0, 200));
};

async function dbListAiLogs(appId) {
  if (appId) {
    var app = await dbGetApplication(appId);
    if (!app || !app.ai_log) return [];
    return app.ai_log.map(function (item) {
      return {
        actor: item.who || item.actor || "System",
        message: item.text || item.message || "",
        created_at: item.at || item.created_at
      };
    });
  }
  var all = await dbListAllApplications();
  var merged = [];
  for (var i = 0; i < all.length; i++) {
    var logs = all[i].ai_log || [];
    for (var j = 0; j < logs.length; j++) {
      merged.push({
        reference_no: all[i].reference_no || all[i].ref_no,
        actor: logs[j].who || "AI",
        message: logs[j].text || "",
        created_at: logs[j].at || all[i].created_at
      });
    }
  }
  return merged;
}

async function dbAddLog(actorEmail, actionText) {
  await dbAddActivity(actionText, actorEmail);
}

async function dbListLogs() {
  var list = await dbListActivity();
  return list.map(function (r) {
    return {
      created_at: r.created_at,
      actor_email: r.actor_email || "system",
      action: r.action + (r.detail ? " (" + r.detail + ")" : "")
    };
  });
}

async function dbCreateAgentLink(agentEmail, note) {
  var code = "REF-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  var item = {
    code: code,
    agent_email: agentEmail,
    note: note || "",
    created_at: new Date().toISOString()
  };
  var list = readSaved("pigem_agent_links", []);
  list.unshift(item);
  writeSaved("pigem_agent_links", list);
  if (!IS_DEMO_MODE && supabaseClient) {
    await supabaseClient.from("agent_links").upsert(item, { onConflict: "code" });
  }
  return item;
}

async function dbListAgentLinks() {
  if (!IS_DEMO_MODE && supabaseClient) {
    var res = await supabaseClient.from("agent_links").select("*").order("created_at", { ascending: false });
    if (res.data && res.data.length > 0) return res.data;
  }
  return readSaved("pigem_agent_links", [
    { code: "REF-CAV01", agent_email: "agent@demo.test", note: "Dasmariñas Walk-in Desk", created_at: new Date(Date.now() - 86400000).toISOString() }
  ]);
}

async function dbListUsers() {
  return await dbListProfiles();
}

async function dbCreateUserAccount(fullName, email, password, role) {
  var cleanEmail = email.trim().toLowerCase();
  var users = getDemoUsers();
  var userId = (role || "agent") + "-" + Date.now();

  if (!IS_DEMO_MODE && supabaseClient) {
    var existing = await supabaseClient.from("users").select("*").eq("email", cleanEmail).maybeSingle();
    if (existing.data) throw new Error("Email is already registered in Supabase.");
    var signUpRes = await supabaseClient.auth.signUp({
      email: cleanEmail,
      password: password,
      options: { data: { full_name: fullName, role: role || "agent" } }
    });
    if (signUpRes.error && signUpRes.error.message.toLowerCase().indexOf("already registered") === -1) {
      throw new Error(signUpRes.error.message);
    }
    if (signUpRes.data && signUpRes.data.user && signUpRes.data.user.id) {
      userId = signUpRes.data.user.id;
    }
    var dbRow = {
      id: userId,
      email: cleanEmail,
      full_name: fullName,
      role: role || "agent",
      active: true,
      activated: true
    };
    var upRes = await supabaseClient.from("users").upsert(dbRow, { onConflict: "email" });
    if (upRes.error) throw new Error(upRes.error.message);
  } else {
    if (findDemoUserByEmail(cleanEmail)) throw new Error("Email is already registered.");
  }

  // Also cache locally so sign-in works immediately even before email confirmation
  var u = {
    id: userId,
    email: cleanEmail,
    password: password || "demo123",
    full_name: fullName,
    role: role || "agent",
    active: true,
    activated: true
  };
  var filtered = users.filter(function (x) { return x.email !== cleanEmail; });
  filtered.push(u);
  writeSaved("pigem_users", filtered);
  await dbAddActivity("user_registered", fullName + " (" + cleanEmail + " - " + (role || "agent") + ")");
  return u;
}

async function dbUpdateUser(userId, changes) {
  return await dbUpdateProfile(userId, changes);
}

// ============================================================
// 8. Live Supabase Sync for Website Content, Plans, Settings & Bucket Assets
// ============================================================

async function dbSaveLiveWebsiteContent(content) {
  if (IS_DEMO_MODE || !supabaseClient) return;
  try {
    await supabaseClient.from("website_content").upsert({
      id: "main",
      data: content,
      updated_at: new Date().toISOString()
    });
  } catch (e) {}
}

async function dbSaveLivePlans(plans) {
  if (IS_DEMO_MODE || !supabaseClient || !Array.isArray(plans)) return;
  try {
    for (var i = 0; i < plans.length; i++) {
      var p = plans[i];
      await supabaseClient.from("plans").upsert({
        id: String(p.id),
        name: p.name,
        speed: Number(String(p.speed).replace(/[^0-9]/g, "")) || 100,
        price: Number(p.price) || 1000,
        tag: p.tag || "Fiber for your home",
        featured: Boolean(p.featured),
        active: p.active !== false
      });
    }
  } catch (e) {}
}

async function dbSaveLiveSystemSettings(settings) {
  if (IS_DEMO_MODE || !supabaseClient) return;
  try {
    await supabaseClient.from("system_settings").upsert({
      id: "main",
      ai_enabled: Boolean(settings.ai_enabled),
      maintenance_mode: Boolean(settings.maintenance_mode),
      maintenance_message: settings.maintenance_message || "",
      updated_at: new Date().toISOString()
    });
  } catch (e) {}
}

// Upload a banner, logo, client logo, vehicle photo, or permit image to the `website-assets` bucket
// and keep it saved in website_content.asset_library[category] so the Manager can switch between saved images anytime!
async function dbUploadWebsiteAsset(file, category) {
  if (!file) throw new Error("Please select an image file first.");
  var folder = category || "Banners";
  var savedPath = "";

  if (IS_DEMO_MODE || !supabaseClient) {
    savedPath = await new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  } else {
    var cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    var path = folder + "/" + Date.now() + "-" + cleanName;
    var res = await supabaseClient.storage.from("website-assets").upload(path, file, { upsert: true });
    if (res.error) throw new Error(res.error.message);
    savedPath = path;
  }

  var wc = getWebsiteContent();
  wc.asset_library = wc.asset_library || {};
  wc.asset_library[folder] = wc.asset_library[folder] || [];
  if (wc.asset_library[folder].indexOf(savedPath) === -1) {
    wc.asset_library[folder].unshift(savedPath);
  }
  saveWebsiteContent(wc);
  await dbAddActivity("website_asset_uploaded", folder + ": " + file.name);
  return savedPath;
}

// Sync live Supabase website_content, plans, and system_settings into localStorage on page load
async function dbSyncLiveSettingsAndContent() {
  if (IS_DEMO_MODE || !supabaseClient) return;
  try {
    var setRes = await supabaseClient.from("system_settings").select("*").eq("id", "main").maybeSingle();
    if (setRes.data) {
      writeSaved("pigem_system_settings", {
        ai_enabled: setRes.data.ai_enabled !== false,
        maintenance_mode: Boolean(setRes.data.maintenance_mode),
        maintenance_message: setRes.data.maintenance_message || ""
      });
      if (typeof checkPublicMaintenance === "function") checkPublicMaintenance();
    }

    var wcRes = await supabaseClient.from("website_content").select("*").eq("id", "main").maybeSingle();
    if (wcRes.data && wcRes.data.data && Object.keys(wcRes.data.data).length > 0) {
      writeSaved("pigem_website_content", wcRes.data.data);
    }

    var plansRes = await supabaseClient.from("plans").select("*").eq("active", true).order("price", { ascending: true });
    if (plansRes.data && plansRes.data.length > 0) {
      writeSaved("pigem_plans", plansRes.data);
    }

    if (typeof loadPageImages === "function") loadPageImages();
    if (typeof window.onLiveContentSynced === "function") window.onLiveContentSynced();
  } catch (e) {}
}

document.addEventListener("DOMContentLoaded", function () {
  dbSyncLiveSettingsAndContent();
});

async function apiCheckIdPhoto(file, details) {
  var res = await apiRunScreening(file, details);
  return {
    overall_status: res.overall_status || (res.status === "not_available" ? "Checked (Fallback)" : "Verified"),
    blur_score: res.blur_score || 120,
    name_match: res.name_match !== false,
    id_number_match: res.id_number_match !== false,
    issues: res.issues || []
  };
}

async function apiSendOtpEmail(toEmail, code, title) {
  await apiSendEmail(toEmail, title || "Verification Code", "Your 6-digit verification code is: " + code);
}

async function apiSendStatusEmail(toEmail, fullName, refNo, status, remarks) {
  await apiSendEmail(toEmail, "Application " + status + " (" + refNo + ")", "Hello " + fullName + ", your application " + refNo + " is now " + status + ". " + (remarks || ""));
}

