/* main.js v1.0.0 - نهائي
   - تحسينات أمنية: تخزين هاش محلي لكلمات المرور (SHA-256) بدلاً من النص الصريح
   - تعطيل إنشاء حسابات Auth من العميل (معلّق)
   - فرض تغيير كلمة مرور Admin قبل الوصول لباقي الواجهة
   - دعم Firebase (مضمّن) مع fallback إلى localStorage
   - توقيت Gulf باستخدام Luxon zone Asia/Dubai
*/

/* ========== FIREBASE CONFIG (from user) ========== */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDnjSxD_oiGo9T-hlI8ZplRDL0HfZDgknQ",
  authDomain: "car99-moving.firebaseapp.com",
  databaseURL: "https://car99-moving-default-rtdb.firebaseio.com",
  projectId: "car99-moving",
  storageBucket: "car99-moving.firebasestorage.app",
  messagingSenderId: "931694570630",
  appId: "1:931694570630:web:d39cf5461eed97e6d5b507",
  measurementId: "G-7Q1CNSTQDG"
};

/* ========== SETTINGS ========== */
const STORAGE_KEYS = {
  USERS: "cms_users",
  MOVEMENTS: "cms_movements",
  MESSAGES: "cms_messages",
  SESSION: "cms_session"
};

let firebaseMode = false;
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

/* ========== UTIL: SHA-256 hashing for passwords ========== */
async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ========== TIME HELPERS ========== */
function getGulfNow() {
  if (window.luxon && luxon.DateTime) {
    try {
      return luxon.DateTime.now().setZone("Asia/Dubai").toJSDate();
    } catch {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      return new Date(utc + 4 * 60 * 60 * 1000);
    }
  }
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 4 * 60 * 60 * 1000);
}

function formatDateTime(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  let h = dt.getHours();
  const min = String(dt.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${y}-${m}-${d} ${String(h).padStart(2, "0")}:${min} ${ampm}`;
}

/* ========== FIREBASE INIT (compat) ========== */
function initFirebase() {
  try {
    if (typeof firebase !== "undefined" && FIREBASE_CONFIG) {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      firebaseAuth = firebase.auth();
      firebaseDb = firebase.firestore();
      firebaseMode = true;
      console.log("Firebase initialized");
      // Validate storageBucket format (console warning only)
      if (!FIREBASE_CONFIG.storageBucket || !FIREBASE_CONFIG.storageBucket.includes(".")) {
        console.warn("Check storageBucket value in FIREBASE_CONFIG; typical format: PROJECT_ID.appspot.com");
      }
    }
  } catch (e) {
    console.warn("Firebase init failed, using local mode", e);
    firebaseMode = false;
  }
}

/* ========== LOCAL STORAGE HELPERS ========== */
function getArrayLocal(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}
function saveArrayLocal(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}
function saveSessionLocal(user) {
  // store minimal session (no password)
  const safe = { username: user.username, displayName: user.displayName, role: user.role, forceChangePassword: !!user.forceChangePassword };
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(safe));
}
function getSessionLocal() {
  const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function clearSessionLocal() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

/* ========== SEEDING (local fallback) ========== */
async function seedLocalIfEmpty() {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    const adminHash = await hashPassword("1234");
    const userHash = await hashPassword("1234");
    saveArrayLocal(STORAGE_KEYS.USERS, [
      {
        username: "admin",
        passwordHash: adminHash,
        displayName: "Administrator",
        phone: "",
        role: "admin",
        forceChangePassword: true
      },
      {
        username: "user1",
        passwordHash: userHash,
        displayName: "User One",
        phone: "",
        role: "user",
        forceChangePassword: false
      }
    ]);
  }
  if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) {
    saveArrayLocal(STORAGE_KEYS.MOVEMENTS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
    saveArrayLocal(STORAGE_KEYS.MESSAGES, []);
  }
}

/* ========== FIREBASE SEEDING (no client-side auth creation) ========== */
async function seedFirebaseIfEmpty() {
  try {
    const usersSnap = await firebaseDb.collection("users").limit(1).get();
    if (usersSnap.empty) {
      await firebaseDb.collection("users").add({
        username: "admin",
        displayName: "Administrator",
        phone: "",
        role: "admin",
        forceChangePassword: true,
        createdAt: new Date()
      });
      await firebaseDb.collection("users").add({
        username: "user1",
        displayName: "User One",
        phone: "",
        role: "user",
        forceChangePassword: false,
        createdAt: new Date()
      });
      // NOTE: Creating Auth users from client is disabled for production.
      // If you want Auth accounts, create them manually in Firebase Console or via secure server.
    }
  } catch (e) {
    console.warn("Firebase seeding failed", e);
  }
}

/* ========== BOOTSTRAP SEED ALL ========== */
async function seedAll() {
  if (firebaseMode) {
    await seedFirebaseIfEmpty();
  } else {
    await seedLocalIfEmpty();
  }
}

/* ========== UI UTILITIES ========== */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.toggle("active", s.id === id);
  });
}
function showView(id) {
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.toggle("active", v.id === id);
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === id);
  });
}
function showMessage(el, msg, type = "error") {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("success-text", "error-text");
  el.classList.add(type === "success" ? "success-text" : "error-text");
  if (msg) {
    setTimeout(() => {
      el.textContent = "";
    }, 2500);
  }
}

/* ========== APP STATE ========== */
let currentUser = null;
let requirePasswordChange = false;

/* ========== LOGIN HANDLING ========== */
function saveSession(user) {
  saveSessionLocal(user);
}
function getCurrentUser() {
  return getSessionLocal();
}
function clearSession() {
  clearSessionLocal();
}

function initLogin() {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");

  const existing = getCurrentUser();
  if (existing) {
    enterApp(existing);
    return;
  }

  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showMessage(loginError, "Please enter username and password.");
      return;
    }

    if (firebaseMode) {
      try {
        // treat username as email if contains @, else append example domain
        const email = username.includes("@") ? username : `${username}@example.com`;
        // sign in via Firebase Auth
        await firebaseAuth.signInWithEmailAndPassword(email, password);
        // fetch profile from Firestore
        const q = await firebaseDb.collection("users").where("username", "==", username).limit(1).get();
        let profile = null;
        if (!q.empty) {
          profile = { id: q.docs[0].id, ...q.docs[0].data() };
        } else {
          profile = { username, displayName: username, role: "user", forceChangePassword: false };
        }
        // enforce admin force change
        if (profile.role === "admin" && profile.forceChangePassword) {
          saveSession({ username: profile.username, displayName: profile.displayName, role: profile.role, forceChangePassword: true });
          enterApp({ username: profile.username, displayName: profile.displayName, role: profile.role, forceChangePassword: true });
          requirePasswordChange = true;
          alert("Admin must change password now. Go to Settings → Change Password.");
          return;
        }
        saveSession(profile);
        enterApp(profile);
      } catch (err) {
        showMessage(loginError, "Invalid username or password.");
      }
    } else {
      const users = getArrayLocal(STORAGE_KEYS.USERS);
      const found = users.find((u) => u.username === username);
      if (!found) {
        showMessage(loginError, "Invalid username or password.");
        return;
      }
      const hash = await hashPassword(password);
      if (found.passwordHash !== hash) {
        showMessage(loginError, "Invalid username or password.");
        return;
      }
      // enforce admin change
      if (found.role === "admin" && found.forceChangePassword) {
        saveSession({ username: found.username, displayName: found.displayName, role: found.role, forceChangePassword: true });
        enterApp({ username: found.username, displayName: found.displayName, role: found.role, forceChangePassword: true });
        requirePasswordChange = true;
        alert("Admin must change password now. Go to Settings → Change Password.");
        return;
      }
      const safe = { username: found.username, displayName: found.displayName, role: found.role, forceChangePassword: !!found.forceChangePassword };
      saveSession(safe);
      enterApp(safe);
    }
  });
}

/* ========== ENTER APP & INIT UI ========== */
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
  // If admin must change password, force view to settings and disable tabs
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
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewId = btn.dataset.view;
      showView(viewId);
    });
  });
  showView("viewMovements");
}

function initCollapsibles() {
  document.querySelectorAll(".collapsible-header").forEach((header) => {
    header.addEventListener("click", () => {
      const targetId = header.getAttribute("data-target");
      const body = document.getElementById(targetId);
      if (!body) return;
      const open = body.classList.contains("open");
      document.querySelectorAll(".collapsible-body").forEach((b) => {
        if (b.id === targetId) {
          b.classList.toggle("open", !open);
        }
      });
      const indicator = header.querySelector(".collapse-indicator");
      if (indicator) indicator.textContent = open ? "▲" : "▼";
    });
  });
}

/* ========== MOVEMENTS ========== */
function renderDriverSelect() {
  const select = document.getElementById("movementDriverSelect");
  if (!select) return;
  select.innerHTML = "";
  if (firebaseMode) {
    firebaseDb.collection("users").get().then((snap) => {
      snap.docs.forEach((d) => {
        const u = d.data();
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = `${u.displayName} (${u.username})`;
        select.appendChild(opt);
      });
    }).catch(() => {});
  } else {
    const users = getArrayLocal(STORAGE_KEYS.USERS);
    users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = `${u.displayName} (${u.username})`;
      select.appendChild(opt);
    });
  }
}

function buildMovementItem(m, id) {
  const div = document.createElement("div");
  div.className = "list-item";
  div.id = `movement-${id}`;

  const header = document.createElement("div");
  header.className = "list-item-header";

  const left = document.createElement("div");
  const badge = document.createElement("span");
  badge.className = "badge " + m.type;
  badge.textContent = m.type === "receive" ? "RECEIVE" : "DELIVER";

  const title = document.createElement("span");
  title.style.marginLeft = "6px";
  title.textContent = `Car ${m.carNumber} - Plate ${m.plate}`;

  left.appendChild(badge);
  left.appendChild(title);

  const right = document.createElement("div");
  right.className = "list-item-meta";
  right.textContent = m.date || formatDateTime(getGulfNow());

  header.appendChild(left);
  header.appendChild(right);

  const meta = document.createElement("div");
  meta.className = "list-item-meta";
  meta.textContent = `Driver: ${m.driverName || m.driverUsername} | By: ${m.createdBy}`;

  const notes = document.createElement("div");
  notes.className = "message-text";
  notes.textContent = m.notes || "-";

  const actions = document.createElement("div");
  actions.className = "list-item-actions";

  const btnEdit = document.createElement("button");
  btnEdit.className = "action-btn";
  btnEdit.textContent = "Edit";
  btnEdit.addEventListener("click", () => editMovement(id));

  const btnShare = document.createElement("button");
  btnShare.className = "action-btn";
  btnShare.textContent = "Share";
  btnShare.addEventListener("click", () => shareMovement(m));

  const btnPrint = document.createElement("button");
  btnPrint.className = "action-btn";
  btnPrint.textContent = "Print";
  btnPrint.addEventListener("click", () => printMovement(m));

  const btnDelete = document.createElement("button");
  btnDelete.className = "action-btn danger";
  btnDelete.textContent = "Delete";
  btnDelete.addEventListener("click", () => deleteMovement(id));

  actions.appendChild(btnEdit);
  actions.appendChild(btnShare);
  actions.appendChild(btnPrint);
  if (currentUser && currentUser.role === "admin") {
    actions.appendChild(btnDelete);
  }

  div.appendChild(header);
  div.appendChild(meta);
  div.appendChild(notes);
  div.appendChild(actions);

  return div;
}

function renderMovementsList() {
  const container = document.getElementById("movementsList");
  if (!container) return;
  if (firebaseMode) {
    firebaseDb.collection("movements").orderBy("createdAt", "desc").get().then((snap) => {
      if (snap.empty) {
        container.innerHTML = `<div class="info-text">No movements yet.</div>`;
        return;
      }
      container.innerHTML = "";
      snap.docs.forEach((doc) => {
        const m = doc.data();
        const div = buildMovementItem(m, doc.id);
        container.appendChild(div);
      });
    }).catch(() => {
      container.innerHTML = `<div class="info-text">Unable to load movements.</div>`;
    });
  } else {
    const movements = getArrayLocal(STORAGE_KEYS.MOVEMENTS);
    if (movements.length === 0) {
      container.innerHTML = `<div class="info-text">No movements yet.</div>`;
      return;
    }
    container.innerHTML = "";
    movements.slice().reverse().forEach((m) => {
      const div = buildMovementItem(m, m.id);
      container.appendChild(div);
    });
  }
}

function initMovements() {
  renderDriverSelect();
  renderMovementsList();

  const form = document.getElementById("addMovementForm");
  const errorBox = document.getElementById("addMovementError");
  const successBox = document.getElementById("addMovementSuccess");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    if (requirePasswordChange) {
      showMessage(errorBox, "You must change your password first (Settings).");
      return;
    }

    const type = document.getElementById("movementType").value;
    const carNumber = document.getElementById("movementCarNumber").value.trim();
    const plate = document.getElementById("movementPlate").value.trim();
    const driverUsername = document.getElementById("movementDriverSelect").value;
    const notes = document.getElementById("movementNotes").value.trim();

    if (!carNumber || !plate || !driverUsername) {
      showMessage(errorBox, "Please fill required fields.");
      return;
    }

    const now = getGulfNow();
    const movement = {
      type,
      carNumber,
      plate,
      driverUsername,
      driverName: driverUsername,
      notes,
      createdBy: currentUser.username || currentUser.displayName || "unknown",
      date: formatDateTime(now),
      createdAt: now
    };

    if (firebaseMode) {
      try {
        await firebaseDb.collection("movements").add(movement);
        renderMovementsList();
        form.reset();
        showMessage(successBox, "Movement saved.", "success");
      } catch (e) {
        showMessage(errorBox, "Save failed.");
      }
    } else {
      const movements = getArrayLocal(STORAGE_KEYS.MOVEMENTS);
      movement.id = Date.now();
      movements.push(movement);
      saveArrayLocal(STORAGE_KEYS.MOVEMENTS, movements);
      renderMovementsList();
      form.reset();
      showMessage(successBox, "Movement saved.", "success");
    }
  });
}

function editMovement(id) {
  if (firebaseMode) {
    firebaseDb.collection("movements").doc(id).get().then((doc) => {
      if (!doc.exists) return;
      const m = doc.data();
      document.getElementById("movementType").value = m.type;
      document.getElementById("movementCarNumber").value = m.carNumber;
      document.getElementById("movementPlate").value = m.plate;
      document.getElementById("movementNotes").value = m.notes || "";
      document.getElementById("movementDriverSelect").value = m.driverUsername;
      // delete doc to allow re-save as new
      firebaseDb.collection("movements").doc(id).delete().then(() => {
        showView("viewMovements");
      });
    }).catch(() => {});
  } else {
    let movements = getArrayLocal(STORAGE_KEYS.MOVEMENTS);
    const idx = movements.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const m = movements[idx];
    document.getElementById("movementType").value = m.type;
    document.getElementById("movementCarNumber").value = m.carNumber;
    document.getElementById("movementPlate").value = m.plate;
    document.getElementById("movementNotes").value = m.notes || "";
    document.getElementById("movementDriverSelect").value = m.driverUsername;
    movements.splice(idx, 1);
    saveArrayLocal(STORAGE_KEYS.MOVEMENTS, movements);
    renderMovementsList();
    showView("viewMovements");
  }
}

function shareMovement(m) {
  const text = `Movement: ${m.type.toUpperCase()} | Car ${m.carNumber} | Plate ${m.plate} | Driver ${m.driverName} | Date ${m.date} | Notes: ${m.notes || "-"}`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    alert(text);
  }
}

function printMovement(m) {
  const text = `Movement\nType: ${m.type}\nCar: ${m.carNumber}\nPlate: ${m.plate}\nDriver: ${m.driverName}\nBy: ${m.createdBy}\nDate: ${m.date}\nNotes: ${m.notes || "-"}`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<pre>${text}</pre>`);
  w.print();
  w.close();
}

function deleteMovement(id) {
  if (firebaseMode) {
    firebaseDb.collection("movements").doc(id).delete().then(() => {
      renderMovementsList();
    }).catch(() => {});
  } else {
    let movements = getArrayLocal(STORAGE_KEYS.MOVEMENTS);
    movements = movements.filter((m) => m.id !== id);
    saveArrayLocal(STORAGE_KEYS.MOVEMENTS, movements);
    renderMovementsList();
  }
}

/* ========== MEMBERS ========== */
function renderMembersList() {
  const container = document.getElementById("membersList");
  if (!container) return;
  if (firebaseMode) {
    firebaseDb.collection("users").get().then((snap) => {
      if (snap.empty) {
        container.innerHTML = `<div class="info-text">No members.</div>`;
        return;
      }
      container.innerHTML = "";
      snap.docs.forEach((d) => {
        const u = d.data();
        const div = document.createElement("div");
        div.className = "list-item";
        div.id = `member-${u.username}`;
        const header = document.createElement("div");
        header.className = "list-item-header";
        const left = document.createElement("div");
        left.textContent = `${u.displayName} (${u.username})`;
        const right = document.createElement("div");
        right.className = "list-item-meta";
        right.textContent = u.role === "admin" ? "Admin" : "User";
        header.appendChild(left);
        header.appendChild(right);
        const meta = document.createElement("div");
        meta.className = "list-item-meta";
        meta.textContent = `Phone: ${u.phone || "-"}`;
        div.appendChild(header);
        div.appendChild(meta);
        container.appendChild(div);
      });
    }).catch(() => {});
  } else {
    const users = getArrayLocal(STORAGE_KEYS.USERS);
    if (users.length === 0) {
      container.innerHTML = `<div class="info-text">No members.</div>`;
      return;
    }
    container.innerHTML = "";
    users.forEach((u) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.id = `member-${u.username}`;
      const header = document.createElement("div");
      header.className = "list-item-header";
      const left = document.createElement("div");
      left.textContent = `${u.displayName} (${u.username})`;
      const right = document.createElement("div");
      right.className = "list-item-meta";
      right.textContent = u.role === "admin" ? "Admin" : "User";
      header.appendChild(left);
      header.appendChild(right);
      const meta = document.createElement("div");
      meta.className = "list-item-meta";
      meta.textContent = `Phone: ${u.phone || "-"}`;
      div.appendChild(header);
      div.appendChild(meta);
      container.appendChild(div);
    });
  }
}

function renderMessageTargets() {
  const select = document.getElementById("messageTarget");
  if (!select) return;
  select.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All";
  select.appendChild(optAll);

  if (firebaseMode) {
    firebaseDb.collection("users").get().then((snap) => {
      snap.docs.forEach((d) => {
        const u = d.data();
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = `${u.displayName} (${u.username})`;
        select.appendChild(opt);
      });
    }).catch(() => {});
  } else {
    const users = getArrayLocal(STORAGE_KEYS.USERS);
    users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = `${u.displayName} (${u.username})`;
      select.appendChild(opt);
    });
  }
}

function renderStatsUsers() {
  const select = document.getElementById("statsUserSelect");
  if (!select) return;
  select.innerHTML = "";
  if (firebaseMode) {
    firebaseDb.collection("users").get().then((snap) => {
      snap.docs.forEach((d) => {
        const u = d.data();
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = `${u.displayName} (${u.username})`;
        select.appendChild(opt);
      });
    }).catch(() => {});
  } else {
    const users = getArrayLocal(STORAGE_KEYS.USERS);
    users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = `${u.displayName} (${u.username})`;
      select.appendChild(opt);
    });
  }
}

function initMembers() {
  renderMembersList();
  renderDriverSelect();
  renderMessageTargets();
  renderStatsUsers();

  const form = document.getElementById("addMemberForm");
  const errorBox = document.getElementById("addMemberError");
  const successBox = document.getElementById("addMemberSuccess");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (requirePasswordChange) {
      showMessage(errorBox, "You must change your password first (Settings).");
      return;
    }

    const username = document.getElementById("memberUsername").value.trim();
    const password = document.getElementById("memberPassword").value.trim();
    const displayName = document.getElementById("memberDisplayName").value.trim();
    const phone = document.getElementById("memberPhone").value.trim();
    const role = document.getElementById("memberRole").value;

    if (!username || !password || !displayName) {
      showMessage(errorBox, "Please fill required fields.");
      return;
    }

    if (firebaseMode) {
      try {
        await firebaseDb.collection("users").add({
          username,
          displayName,
          phone,
          role,
          forceChangePassword: role === "admin",
          createdAt: new Date()
        });
        // NOTE: Creating Auth users from client is disabled for production.
        // If you want Auth accounts, create them manually in Firebase Console or via secure server.
        renderMembersList();
        renderDriverSelect();
        renderMessageTargets();
        renderStatsUsers();
        form.reset();
        showMessage(successBox, "Member saved.", "success");
      } catch {
        showMessage(errorBox, "Save failed.");
      }
    } else {
      const users = getArrayLocal(STORAGE_KEYS.USERS);
      if (users.find((u) => u.username === username)) {
        showMessage(errorBox, "Username already exists.");
        return;
      }
      const passwordHash = await hashPassword(password);
      users.push({ username, passwordHash, displayName, phone, role, forceChangePassword: role === "admin" });
      saveArrayLocal(STORAGE_KEYS.USERS, users);
      form.reset();
      renderMembersList();
      renderDriverSelect();
      renderMessageTargets();
      renderStatsUsers();
      showMessage(successBox, "Member saved.", "success");
    }
  });
}

/* ========== MESSAGES ========== */
function renderMessagesList() {
  const container = document.getElementById("messagesList");
  if (!container) return;
  if (firebaseMode) {
    firebaseDb.collection("messages").orderBy("createdAt", "desc").get().then((snap) => {
      if (snap.empty) {
        container.innerHTML = `<div class="info-text">No messages.</div>`;
        return;
      }
      container.innerHTML = "";
      snap.docs.forEach((d) => {
        const msg = d.data();
        const div = document.createElement("div");
        div.className = "list-item";
        div.id = `message-${d.id}`;
        const from = document.createElement("div");
        from.className = "message-from";
        from.textContent = msg.from;
        const text = document.createElement("div");
        text.className = "message-text";
        text.textContent = msg.text;
        const meta = document.createElement("div");
        meta.className = "message-meta";
        meta.textContent = `${msg.date} | To: ${msg.toLabel}`;
        div.appendChild(from);
        div.appendChild(text);
        div.appendChild(meta);
        container.appendChild(div);
      });
    }).catch(() => {});
  } else {
    const messages = getArrayLocal(STORAGE_KEYS.MESSAGES);
    if (messages.length === 0) {
      container.innerHTML = `<div class="info-text">No messages.</div>`;
      return;
    }
    container.innerHTML = "";
    messages.slice().reverse().forEach((msg) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.id = `message-${msg.id}`;
      const from = document.createElement("div");
      from.className = "message-from";
      from.textContent = msg.from;
      const text = document.createElement("div");
      text.className = "message-text";
      text.textContent = msg.text;
      const meta = document.createElement("div");
      meta.className = "message-meta";
      meta.textContent = `${msg.date} | To: ${msg.toLabel}`;
      div.appendChild(from);
      div.appendChild(text);
      div.appendChild(meta);
      container.appendChild(div);
    });
  }
}

function initMessages() {
  renderMessageTargets();
  renderMessagesList();

  const form = document.getElementById("sendMessageForm");
  const errorBox = document.getElementById("sendMessageError");
  const successBox = document.getElementById("sendMessageSuccess");
  const textArea = document.getElementById("messageText");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (requirePasswordChange) {
      showMessage(errorBox, "You must change your password first (Settings).");
      return;
    }

    const target = document.getElementById("messageTarget").value;
    const text = textArea.value.trim();

    if (!text) {
      showMessage(errorBox, "Message cannot be empty.");
      return;
    }

    let toLabel = "All";
    if (target !== "all") {
      if (firebaseMode) {
        const q = await firebaseDb.collection("users").where("username", "==", target).limit(1).get();
        if (!q.empty) toLabel = `${q.docs[0].data().displayName} (${target})`;
        else toLabel = target;
      } else {
        const u = getArrayLocal(STORAGE_KEYS.USERS).find((x) => x.username === target);
        toLabel = u ? `${u.displayName} (${u.username})` : target;
      }
    }

    const now = getGulfNow();
    const message = {
      from: currentUser.displayName || currentUser.username,
      to: target,
      toLabel,
      text,
      date: formatDateTime(now),
      createdAt: now
    };

    if (firebaseMode) {
      try {
        await firebaseDb.collection("messages").add(message);
        form.reset();
        renderMessagesList();
        showMessage(successBox, "Message sent.", "success");
      } catch {
        showMessage(errorBox, "Send failed.");
      }
    } else {
      const messages = getArrayLocal(STORAGE_KEYS.MESSAGES);
      message.id = Date.now();
      messages.push(message);
      saveArrayLocal(STORAGE_KEYS.MESSAGES, messages);
      form.reset();
      renderMessagesList();
      showMessage(successBox, "Message sent.", "success");
    }
  });
}

/* ========== STATISTICS ========== */
function updateStatsSummary() {
  const box = document.getElementById("statsSummaryBox");
  if (!box) return;
  if (firebaseMode) {
    firebaseDb.collection("movements").get().then((snap) => {
      const total = snap.size;
      const received = snap.docs.filter((d) => d.data().type === "receive").length;
      const delivered = snap.docs.filter((d) => d.data().type === "deliver").length;
      box.innerHTML = `
        <div class="info-text">Total movements: ${total}</div>
        <div class="info-text">Received: ${received}</div>
        <div class="info-text">Delivered: ${delivered}</div>
      `;
    }).catch(() => {});
  } else {
    const movements = getArrayLocal(STORAGE_KEYS.MOVEMENTS);
    const total = movements.length;
    const received = movements.filter((m) => m.type === "receive").length;
    const delivered = movements.filter((m) => m.type === "deliver").length;
    box.innerHTML = `
      <div class="info-text">Total movements: ${total}</div>
      <div class="info-text">Received: ${received}</div>
      <div class="info-text">Delivered: ${delivered}</div>
    `;
  }
}

function initStatistics() {
  updateStatsSummary();
  renderStatsUsers();

  const formRange = document.getElementById("statsRangeForm");
  const rangeResult = document.getElementById("statsRangeResult");
  if (formRange) {
    formRange.addEventListener("submit", (e) => {
      e.preventDefault();
      const fromDate = document.getElementById("statsFromDate").value;
      const toDate = document.getElementById("statsToDate").value;
      if (!fromDate || !toDate) {
        rangeResult.textContent = "Please select both dates.";
        return;
      }
      const fromTime = new Date(fromDate + "T00:00:00").getTime();
      const toTime = new Date(toDate + "T23:59:59").getTime();

      if (firebaseMode) {
        firebaseDb.collection("movements").get().then((snap) => {
          const filtered = snap.docs.filter((d) => {
            const t = new Date(d.data().date.replace(" ", "T")).getTime();
            return t >= fromTime && t <= toTime;
          });
          rangeResult.textContent = `Movements in range: ${filtered.length}`;
        }).catch(() => {});
      } else {
        const movements = getArrayLocal(STORAGE_KEYS.MOVEMENTS);
        const filtered = movements.filter((m) => {
          const t = new Date(m.date.replace(" ", "T")).getTime();
          return t >= fromTime && t <= toTime;
        });
        rangeResult.textContent = `Movements in range: ${filtered.length}`;
      }
    });
  }

  const formUser = document.getElementById("statsUserForm");
  const userResult = document.getElementById("statsUserResult");
  if (formUser) {
    formUser.addEventListener("submit", (e) => {
      e.preventDefault();
      const selected = document.getElementById("statsUserSelect").value;
      if (firebaseMode) {
        firebaseDb.collection("movements").get().then((snap) => {
          const count = snap.docs.filter((d) => {
            const m = d.data();
            return m.createdBy === selected || m.driverUsername === selected;
          }).length;
          userResult.textContent = `Movements related to this user: ${count}`;
        }).catch(() => {});
      } else {
        const movements = getArrayLocal(STORAGE_KEYS.MOVEMENTS);
        const count = movements.filter((m) => m.createdBy === selected || m.driverUsername === selected).length;
        userResult.textContent = `Movements related to this user: ${count}`;
      }
    });
  }

  const formCar = document.getElementById("statsCarForm");
  const carResult = document.getElementById("statsCarResult");
  if (formCar) {
    formCar.addEventListener("submit", (e) => {
      e.preventDefault();
      const carNumber = document.getElementById("statsCarNumber").value.trim();
      if (!carNumber) {
        carResult.textContent = "Please enter car number.";
        return;
      }
      if (firebaseMode) {
        firebaseDb.collection("movements").get().then((snap) => {
          const count = snap.docs.filter((d) => d.data().carNumber.toLowerCase() === carNumber.toLowerCase()).length;
          carResult.textContent = `Movements for this car: ${count}`;
        }).catch(() => {});
      } else {
        const movements = getArrayLocal(STORAGE_KEYS.MOVEMENTS);
        const count = movements.filter((m) => m.carNumber.toLowerCase() === carNumber.toLowerCase()).length;
        carResult.textContent = `Movements for this car: ${count}`;
      }
    });
  }
}

/* ========== SETTINGS ========== */
function initSettings() {
  const passForm = document.getElementById("changePasswordForm");
  const passError = document.getElementById("changePasswordError");
  const passSuccess = document.getElementById("changePasswordSuccess");

  const phoneForm = document.getElementById("changePhoneForm");
  const phoneError = document.getElementById("changePhoneError");
  const phoneSuccess = document.getElementById("changePhoneSuccess");

  if (passForm) {
    passForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      const oldPassword = document.getElementById("oldPassword").value.trim();
      const newPassword = document.getElementById("newPassword").value.trim();
      const confirmPassword = document.getElementById("confirmPassword").value.trim();

      if (!oldPassword || !newPassword || !confirmPassword) {
        showMessage(passError, "Please fill all fields.");
        return;
      }
      if (newPassword !== confirmPassword) {
        showMessage(passError, "New passwords do not match.");
        return;
      }

      if (firebaseMode) {
        try {
          // Re-authenticate then update password
          const email = currentUser.username.includes("@") ? currentUser.username : `${currentUser.username}@example.com`;
          const cred = firebase.auth.EmailAuthProvider.credential(email, oldPassword);
          await firebaseAuth.currentUser.reauthenticateWithCredential(cred);
          await firebaseAuth.currentUser.updatePassword(newPassword);
          // update Firestore flag if admin
          const q = await firebaseDb.collection("users").where("username", "==", currentUser.username).limit(1).get();
          if (!q.empty) {
            const docId = q.docs[0].id;
            await firebaseDb.collection("users").doc(docId).update({ forceChangePassword: false });
          }
          showMessage(passSuccess, "Password updated.", "success");
          passForm.reset();
          // clear force change state
          requirePasswordChange = false;
          disableTabsExceptSettings(false);
        } catch (err) {
          showMessage(passError, "Password update failed. Check current password.");
        }
      } else {
        const users = getArrayLocal(STORAGE_KEYS.USERS);
        const idx = users.findIndex((u) => u.username === currentUser.username);
        if (idx === -1) {
          showMessage(passError, "User not found.");
          return;
        }
        const oldHash = await hashPassword(oldPassword);
        if (users[idx].passwordHash !== oldHash) {
          showMessage(passError, "Current password is incorrect.");
          return;
        }
        const newHash = await hashPassword(newPassword);
        users[idx].passwordHash = newHash;
        users[idx].forceChangePassword = false;
        saveArrayLocal(STORAGE_KEYS.USERS, users);
        currentUser.forceChangePassword = false;
        saveSession(currentUser);
        showMessage(passSuccess, "Password updated.", "success");
        passForm.reset();
        requirePasswordChange = false;
        disableTabsExceptSettings(false);
      }
    });
  }

  if (phoneForm) {
    phoneForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!currentUser) return;
      const newPhone = document.getElementById("newPhone").value.trim();
      if (!newPhone) {
        showMessage(phoneError, "Please enter phone.");
        return;
      }
      if (firebaseMode) {
        firebaseDb.collection("users").where("username", "==", currentUser.username).limit(1).get().then((q) => {
          if (!q.empty) {
            firebaseDb.collection("users").doc(q.docs[0].id).update({ phone: newPhone }).then(() => {
              showMessage(phoneSuccess, "Phone updated.", "success");
            }).catch(() => {
              showMessage(phoneError, "Update failed.");
            });
          } else {
            showMessage(phoneError, "User not found.");
          }
        }).catch(() => {
          showMessage(phoneError, "Update failed.");
        });
      } else {
        const users = getArrayLocal(STORAGE_KEYS.USERS);
        const idx = users.findIndex((u) => u.username === currentUser.username);
        if (idx === -1) {
          showMessage(phoneError, "User not found.");
          return;
        }
        users[idx].phone = newPhone;
        saveArrayLocal(STORAGE_KEYS.USERS, users);
        currentUser.phone = newPhone;
        saveSession(currentUser);
        showMessage(phoneSuccess, "Phone updated.", "success");
        phoneForm.reset();
      }
    });
  }
}

/* ========== GLOBAL SEARCH ========== */
function initGlobalSearch() {
  const overlay = document.getElementById("searchOverlay");
  const openBtn = document.getElementById("headerSearchBtn");
  const closeBtn = document.getElementById("closeSearchBtn");
  const input = document.getElementById("globalSearchInput");
  const box = document.getElementById("globalSearchResults");

  if (!overlay || !openBtn || !closeBtn || !input || !box) return;

  openBtn.addEventListener("click", () => {
    overlay.classList.add("active");
    input.value = "";
    box.innerHTML = "";
    input.focus();
  });

  closeBtn.addEventListener("click", () => {
    overlay.classList.remove("active");
  });

  input.addEventListener("input", async () => {
    const term = input.value.trim().toLowerCase();
    if (!term) {
      box.innerHTML = "";
      return;
    }
    const results = [];
    if (firebaseMode) {
      const movSnap = await firebaseDb.collection("movements").get().catch(() => null);
      if (movSnap) {
        movSnap.docs.forEach((d) => {
          const m = d.data();
          const text = `${m.carNumber} ${m.plate} ${m.driverName} ${m.notes}`.toLowerCase();
          if (text.includes(term)) {
            results.push({ type: "movement", id: d.id, label: `Movement: ${m.carNumber} / ${m.plate} / ${m.driverName}` });
          }
        });
      }
      const usersSnap = await firebaseDb.collection("users").get().catch(() => null);
      if (usersSnap) {
        usersSnap.docs.forEach((d) => {
          const u = d.data();
          const text = `${u.username} ${u.displayName} ${u.phone}`.toLowerCase();
          if (text.includes(term)) {
            results.push({ type: "member", id: u.username, label: `Member: ${u.displayName} (${u.username})` });
          }
        });
      }
      const msgSnap = await firebaseDb.collection("messages").get().catch(() => null);
      if (msgSnap) {
        msgSnap.docs.forEach((d) => {
          const msg = d.data();
          const text = `${msg.text} ${msg.from} ${msg.toLabel}`.toLowerCase();
          if (text.includes(term)) {
            results.push({ type: "message", id: d.id, label: `Message: ${msg.text}` });
          }
        });
      }
    } else {
      const movements = getArrayLocal(STORAGE_KEYS.MOVEMENTS);
      const users = getArrayLocal(STORAGE_KEYS.USERS);
      const messages = getArrayLocal(STORAGE_KEYS.MESSAGES);

      movements.forEach((m) => {
        const text = `${m.carNumber} ${m.plate} ${m.driverName} ${m.notes}`.toLowerCase();
        if (text.includes(term)) {
          results.push({ type: "movement", id: m.id, label: `Movement: ${m.carNumber} / ${m.plate} / ${m.driverName}` });
        }
      });

      users.forEach((u) => {
        const text = `${u.username} ${u.displayName} ${u.phone}`.toLowerCase();
        if (text.includes(term)) {
          results.push({ type: "member", id: u.username, label: `Member: ${u.displayName} (${u.username})` });
        }
      });

      messages.forEach((msg) => {
        const text = `${msg.text} ${msg.from} ${msg.toLabel}`.toLowerCase();
        if (text.includes(term)) {
          results.push({ type: "message", id: msg.id, label: `Message: ${msg.text}` });
        }
      });
    }

    if (results.length === 0) {
      box.innerHTML = `<div class="search-result-item">No results.</div>`;
    } else {
      box.innerHTML = "";
      results.forEach((r) => {
        const div = document.createElement("div");
        div.className = "search-result-item";
        div.textContent = r.label;
        div.addEventListener("click", () => {
          overlay.classList.remove("active");
          if (r.type === "movement") {
            showView("viewMovements");
            setTimeout(() => {
              const el = document.getElementById(`movement-${r.id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 50);
          } else if (r.type === "member") {
            showView("viewMembers");
            setTimeout(() => {
              const el = document.getElementById(`member-${r.id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 50);
          } else if (r.type === "message") {
            showView("viewMessages");
            setTimeout(() => {
              const el = document.getElementById(`message-${r.id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 50);
          }
        });
        box.appendChild(div);
      });
    }
  });
}

/* ========== LOGOUT ========== */
function initLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;
  logoutBtn.addEventListener("click", () => {
    clearSession();
    currentUser = null;
    showScreen("screenLogin");
  });
}

/* ========== PWA SERVICE WORKER REGISTER ========== */
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

/* ========== BOOTSTRAP ========== */
document.addEventListener("DOMContentLoaded", async () => {
  initFirebase();
  await seedAll();
  registerServiceWorker();
  initLogin();
});
