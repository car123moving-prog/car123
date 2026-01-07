/* main.js - Diagnostic local-only version
   - يعمل داخلياً بدون Console أو Firebase
   - يقوم بالـ seeding تلقائياً عند أول تحميل
   - عند أي فشل في تسجيل الدخول يعرض alert ويخزن سبب الفشل في localStorage.cms_last_error
   - بعد رفع هذا الملف: امسح بيانات الموقع (Storage) ثم أعد تحميل الصفحة
*/

const STORAGE_KEYS = {
  USERS: "cms_users",
  MOVEMENTS: "cms_movements",
  MESSAGES: "cms_messages",
  SESSION: "cms_session",
  LAST_ERROR: "cms_last_error"
};

async function hashPassword(password) {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    // fallback simple hash (not secure) only for diagnostics if crypto unavailable
    let h = 0;
    for (let i = 0; i < password.length; i++) h = (h << 5) - h + password.charCodeAt(i);
    return String(h >>> 0);
  }
}

function saveLastError(msg) {
  try {
    const payload = { time: new Date().toISOString(), message: msg };
    localStorage.setItem(STORAGE_KEYS.LAST_ERROR, JSON.stringify(payload));
  } catch (e) {
    // ignore
  }
}

function getArrayLocal(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try { return JSON.parse(raw) || []; } catch { return []; }
}
function saveArrayLocal(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}
function saveSessionLocal(user) {
  const safe = { username: user.username, displayName: user.displayName, role: user.role, forceChangePassword: !!user.forceChangePassword };
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(safe));
}
function getSessionLocal() {
  const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function clearSessionLocal() { localStorage.removeItem(STORAGE_KEYS.SESSION); }

async function seedLocalIfEmpty() {
  try {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      const adminHash = await hashPassword("1234");
      const userHash = await hashPassword("1234");
      const users = [
        { username: "admin", passwordHash: adminHash, displayName: "Administrator", phone: "", role: "admin", forceChangePassword: true },
        { username: "user1", passwordHash: userHash, displayName: "User One", phone: "", role: "user", forceChangePassword: false }
      ];
      saveArrayLocal(STORAGE_KEYS.USERS, users);
    }
    if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) saveArrayLocal(STORAGE_KEYS.MOVEMENTS, []);
    if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) saveArrayLocal(STORAGE_KEYS.MESSAGES, []);
  } catch (e) {
    saveLastError("seeding_failed:" + (e && e.message ? e.message : String(e)));
    alert("خطأ أثناء تهيئة البيانات المحلية. راجع السجل المحلي.");
  }
}

/* UI helpers (minimal) */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
}
function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === id));
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === id));
}
function showMessage(el, msg, type = "error") {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("success-text", "error-text");
  el.classList.add(type === "success" ? "success-text" : "error-text");
  if (msg) setTimeout(() => { el.textContent = ""; }, 3000);
}

/* Login logic (local only) */
async function initLogin() {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");

  if (!loginForm || !usernameInput || !passwordInput) {
    saveLastError("missing_login_elements");
    alert("عناصر صفحة تسجيل الدخول مفقودة. تأكد من أن index.html لم يتغير.");
    return;
  }

  const existing = getSessionLocal();
  if (existing) {
    enterApp(existing);
    return;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) {
      showMessage(loginError, "الرجاء إدخال اسم المستخدم وكلمة المرور.");
      saveLastError("empty_credentials");
      return;
    }
    const users = getArrayLocal(STORAGE_KEYS.USERS);
    if (!users || users.length === 0) {
      showMessage(loginError, "لا يوجد مستخدمون محلياً. سيتم إعادة تهيئة البيانات الآن.");
      saveLastError("no_local_users");
      await seedLocalIfEmpty();
      return;
    }
    const found = users.find((u) => u.username === username);
    if (!found) {
      showMessage(loginError, "اسم المستخدم أو كلمة المرور غير صحيحة.");
      saveLastError("user_not_found:" + username);
      alert("فشل تسجيل الدخول: المستخدم غير موجود.");
      return;
    }
    const hash = await hashPassword(password);
    if (found.passwordHash !== hash) {
      showMessage(loginError, "اسم المستخدم أو كلمة المرور غير صحيحة.");
      saveLastError("password_mismatch_for:" + username);
      alert("فشل تسجيل الدخول: كلمة المرور غير صحيحة.");
      return;
    }
    // success
    const safe = { username: found.username, displayName: found.displayName, role: found.role, forceChangePassword: !!found.forceChangePassword };
    saveSessionLocal(safe);
    if (found.role === "admin" && found.forceChangePassword) {
      saveLastError("admin_requires_password_change");
      alert("المشرف مطالب بتغيير كلمة المرور الآن. سيتم توجيهك إلى الإعدادات.");
      enterApp(safe);
      requirePasswordChange = true;
      return;
    }
    enterApp(safe);
  });
}

/* Minimal app init and functions needed for login flow */
let currentUser = null;
let requirePasswordChange = false;

function enterApp(user) {
  currentUser = user;
  showScreen("screenHome");
  updateUserBar();
  initTabs();
  initCollapsibles();
  initMovements();
  initMembers();
  initMessages();
  initStatistics();
  initSettings();
  initGlobalSearch();
  initLogout();
  if (user && user.role === "admin" && user.forceChangePassword) {
    requirePasswordChange = true;
    showView("viewSettings");
    disableTabsExceptSettings(true);
  } else {
    requirePasswordChange = false;
    disableTabsExceptSettings(false);
  }
}

function updateUserBar() {
  const nameEl = document.getElementById("currentUserName");
  const roleEl = document.getElementById("currentUserRole");
  if (!currentUser) return;
  if (nameEl) nameEl.textContent = currentUser.displayName || currentUser.username;
  if (roleEl) roleEl.textContent = currentUser.role === "admin" ? "Administrator" : "User";
}
function disableTabsExceptSettings(disable) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    if (btn.dataset.view !== "viewSettings") {
      btn.disabled = disable;
      btn.style.pointerEvents = disable ? "none" : "";
      btn.style.opacity = disable ? "0.5" : "";
    }
  });
}
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.view)));
  showView("viewMovements");
}
function initCollapsibles() {
  document.querySelectorAll(".collapsible-header").forEach((h) => h.addEventListener("click", () => {
    const target = h.getAttribute("data-target"); const body = document.getElementById(target);
    if (!body) return; body.classList.toggle("open"); const ind = h.querySelector(".collapse-indicator"); if (ind) ind.textContent = body.classList.contains("open") ? "▼" : "▲";
  }));
}

/* Minimal stubs for other modules (they use localStorage functions above) */
function renderDriverSelect() {
  const select = document.getElementById("movementDriverSelect");
  if (!select) return;
  select.innerHTML = "";
  const users = getArrayLocal(STORAGE_KEYS.USERS);
  users.forEach((u) => { const opt = document.createElement("option"); opt.value = u.username; opt.textContent = `${u.displayName} (${u.username})`; select.appendChild(opt); });
}
function renderMovementsList() {
  const container = document.getElementById("movementsList");
  if (!container) return;
  const movements = getArrayLocal(STORAGE_KEYS.MOVEMENTS);
  if (!movements || movements.length === 0) { container.innerHTML = `<div class="info-text">No movements yet.</div>`; return; }
  container.innerHTML = "";
  movements.slice().reverse().forEach((m) => {
    const div = document.createElement("div"); div.className = "list-item"; div.id = `movement-${m.id}`;
    div.innerHTML = `<div class="list-item-header"><div><span class="badge ${m.type}">${m.type.toUpperCase()}</span><span style="margin-left:6px">Car ${m.carNumber} - Plate ${m.plate}</span></div><div class="list-item-meta">${m.date}</div></div><div class="list-item-meta">Driver: ${m.driverName} | By: ${m.createdBy}</div><div class="message-text">${m.notes||'-'}</div>`;
    container.appendChild(div);
  });
}
function initMovements() { renderDriverSelect(); renderMovementsList(); /* add form handler if present */ }
function renderMembersList() {
  const container = document.getElementById("membersList"); if (!container) return;
  const users = getArrayLocal(STORAGE_KEYS.USERS); if (!users || users.length === 0) { container.innerHTML = `<div class="info-text">No members.</div>`; return; }
  container.innerHTML = ""; users.forEach((u) => { const div = document.createElement("div"); div.className = "list-item"; div.id = `member-${u.username}`; div.innerHTML = `<div class="list-item-header"><div>${u.displayName} (${u.username})</div><div class="list-item-meta">${u.role==='admin'?'Admin':'User'}</div></div><div class="list-item-meta">Phone: ${u.phone||'-'}</div>`; container.appendChild(div); });
}
function initMembers() { renderMembersList(); renderDriverSelect(); renderMessageTargets(); /* add form handler if present */ }
function renderMessageTargets() { const select = document.getElementById("messageTarget"); if (!select) return; select.innerHTML = ""; const optAll = document.createElement("option"); optAll.value = "all"; optAll.textContent = "All"; select.appendChild(optAll); const users = getArrayLocal(STORAGE_KEYS.USERS); users.forEach((u)=>{ const opt=document.createElement("option"); opt.value=u.username; opt.textContent=`${u.displayName} (${u.username})`; select.appendChild(opt); }); }
function renderMessagesList() { const container = document.getElementById("messagesList"); if (!container) return; const messages = getArrayLocal(STORAGE_KEYS.MESSAGES); if (!messages || messages.length===0) { container.innerHTML=`<div class="info-text">No messages.</div>`; return; } container.innerHTML=""; messages.slice().reverse().forEach((m)=>{ const div=document.createElement("div"); div.className="list-item"; div.id=`message-${m.id}`; div.innerHTML=`<div class="message-from">${m.from}</div><div class="message-text">${m.text}</div><div class="message-meta">${m.date} | To: ${m.toLabel}</div>`; container.appendChild(div); }); }
function initMessages() { renderMessageTargets(); renderMessagesList(); /* add form handler if present */ }
function updateStatsSummary() { const box=document.getElementById("statsSummaryBox"); if(!box) return; const movements=getArrayLocal(STORAGE_KEYS.MOVEMENTS); const total=movements.length; const received=movements.filter(m=>m.type==='receive').length; const delivered=movements.filter(m=>m.type==='deliver').length; box.innerHTML=`<div class="info-text">Total movements: ${total}</div><div class="info-text">Received: ${received}</div><div class="info-text">Delivered: ${delivered}</div>`; }
function initStatistics(){ updateStatsSummary(); }
function initSettings(){ /* minimal: change password handled if forms exist in DOM */ const passForm=document.getElementById("changePasswordForm"); if(passForm){ passForm.addEventListener("submit", async (e)=>{ e.preventDefault(); const oldPassword=document.getElementById("oldPassword").value.trim(); const newPassword=document.getElementById("newPassword").value.trim(); const confirmPassword=document.getElementById("confirmPassword").value.trim(); if(!oldPassword||!newPassword||!confirmPassword){ alert("Please fill all fields."); return; } if(newPassword!==confirmPassword){ alert("New passwords do not match."); return; } const users=getArrayLocal(STORAGE_KEYS.USERS); const idx=users.findIndex(u=>u.username===currentUser.username); if(idx===-1){ alert("User not found."); return; } const oldHash=await hashPassword(oldPassword); if(users[idx].passwordHash!==oldHash){ alert("Current password incorrect."); return; } users[idx].passwordHash=await hashPassword(newPassword); users[idx].forceChangePassword=false; saveArrayLocal(STORAGE_KEYS.USERS, users); currentUser.forceChangePassword=false; saveSessionLocal(currentUser); alert("Password updated."); disableTabsExceptSettings(false); } ); } }
function initGlobalSearch(){ /* minimal */ }
function initLogout(){ const logoutBtn=document.getElementById("logoutBtn"); if(!logoutBtn) return; logoutBtn.addEventListener("click", ()=>{ clearSessionLocal(); currentUser=null; showScreen("screenLogin"); }); }

/* bootstrap */
document.addEventListener("DOMContentLoaded", async () => {
  await seedLocalIfEmpty();
  // small visual indicator if seeding succeeded
  const users = getArrayLocal(STORAGE_KEYS.USERS);
  if (!users || users.length === 0) {
    saveLastError("seeding_result_empty");
    alert("فشل تهيئة المستخدمين المحليين. تأكد من رفع الملفات الصحيحة.");
  } else {
    // notify user that local mode is active
    // (silent notification to avoid extra popups)
    localStorage.setItem('cms_mode','local');
  }
  initLogin();
});
