// main.js – Realtime + UI v1 (Firebase Realtime + Notifications + Accordion + Tabs)

// =========================
// 1) Firebase setup
// =========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  child,
  push,
  onValue,
  onChildAdded,
  serverTimestamp,
  update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnjSxD_oiGo9T-hlI8ZplRDL0HfZDgknQ",
  authDomain: "car99-moving.firebaseapp.com",
  databaseURL: "https://car99-moving-default-rtdb.firebaseio.com",
  projectId: "car99-moving",
  storageBucket: "car99-moving.firebasestorage.app",
  messagingSenderId: "931694570630",
  appId: "1:931694570630:web:d39cf5461eed97e6d5b507",
  measurementId: "G-7Q1CNSTQDG"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// =========================
// 2) Helpers
// =========================
async function hashPassword(password) {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    // fallback (غير آمن لكن يكفي للتطوير)
    let h = 0;
    for (let i = 0; i < password.length; i++) {
      h = (h << 5) - h + password.charCodeAt(i);
      h |= 0;
    }
    return String(h >>> 0);
  }
}

function getGulfNow() {
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

// Toast notification for messages
function showToast(text) {
  let box = document.getElementById("toastBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    box.style.position = "fixed";
    box.style.top = "70px";
    box.style.right = "16px";
    box.style.zIndex = "9999";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "8px";
    document.body.appendChild(box);
  }
  const toast = document.createElement("div");
  toast.textContent = text;
  toast.style.background = "#0b3c6f";
  toast.style.color = "#fff";
  toast.style.padding = "10px 14px";
  toast.style.borderRadius = "8px";
  toast.style.boxShadow = "0 6px 18px rgba(0,0,0,0.18)";
  toast.style.fontSize = "13px";
  box.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// =========================
// 3) Global state
// =========================
let currentUser = null;
let requirePasswordChange = false;
let movementsCache = [];
let usersCache = [];
let messagesCache = [];

// =========================
// 4) Firebase data helpers
// =========================
async function ensureDefaultUsers() {
  const snap = await get(ref(db, "users"));
  if (!snap.exists()) {
    const adminHash = await hashPassword("1234");
    const userHash = await hashPassword("1234");
    const updates = {};
    updates["users/admin"] = {
      username: "admin",
      passwordHash: adminHash,
      displayName: "Administrator",
      phone: "",
      role: "admin",
      forceChangePassword: true
    };
    updates["users/user1"] = {
      username: "user1",
      passwordHash: userHash,
      displayName: "User One",
      phone: "",
      role: "user",
      forceChangePassword: false
    };
    await update(ref(db), updates);
  }
}

async function loadUsers() {
  const snap = await get(ref(db, "users"));
  usersCache = [];
  if (snap.exists()) {
    const val = snap.val();
    usersCache = Object.values(val);
  }
}

function listenMovements() {
  const movementsRef = ref(db, "movements");
  onValue(movementsRef, (snapshot) => {
    movementsCache = [];
    if (snapshot.exists()) {
      const val = snapshot.val();
      movementsCache = Object.keys(val).map((key) => ({
        id: key,
        ...val[key]
      }));
    }
    renderMovementsList();
  });
}

function listenMessages() {
  const messagesRef = ref(db, "messages");
  // تحديث القائمة كاملة
  onValue(messagesRef, (snapshot) => {
    messagesCache = [];
    if (snapshot.exists()) {
      const val = snapshot.val();
      messagesCache = Object.keys(val).map((key) => ({
        id: key,
        ...val[key]
      }));
    }
    renderMessagesList();
  });
  // إشعار عند وصول رسالة جديدة
  onChildAdded(messagesRef, (snapshot) => {
    const msg = snapshot.val();
    if (!currentUser) return;
    // لا نعرض إشعار للرسالة التي أرسلها نفس المستخدم
    if (msg.fromUsername && msg.fromUsername === currentUser.username) return;
    showToast(`New message from ${msg.fromDisplayName || msg.fromUsername}`);
  });
}

// =========================
// 5) Login & session
// =========================
function saveSessionLocal(user) {
  const safe = {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    forceChangePassword: !!user.forceChangePassword
  };
  localStorage.setItem("cms_session", JSON.stringify(safe));
}

function getSessionLocal() {
  const raw = localStorage.getItem("cms_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSessionLocal() {
  localStorage.removeItem("cms_session");
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
      showView(btn.dataset.view);
    });
  });
  showView("viewMovements");
}

function initCollapsibles() {
  document.querySelectorAll(".collapsible-header").forEach((h) => {
    h.addEventListener("click", () => {
      const target = h.getAttribute("data-target");
      const body = document.getElementById(target);
      if (!body) return;
      const open = body.classList.contains("open");
      // أكورديون: نغلق الكل ونفتح واحد فقط
      document.querySelectorAll(".collapsible-body").forEach((b) => {
        b.classList.remove("open");
      });
      if (!open) body.classList.add("open");
      document.querySelectorAll(".collapse-indicator").forEach((ind) => {
        ind.textContent = "▼";
      });
      const ind = h.querySelector(".collapse-indicator");
      if (ind && !open) ind.textContent = "▲";
    });
  });

  // نجعل قسم "Add Movement" مفتوح دائمًا افتراضيًا
  const addMovementBody = document.getElementById("addMovementBody");
  if (addMovementBody) addMovementBody.classList.add("open");
}

async function handleLogin() {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");

  const existing = getSessionLocal();
  if (existing) {
    currentUser = existing;
    enterApp();
    return;
  }

  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) {
      showMessage(loginError, "الرجاء إدخال اسم المستخدم وكلمة المرور.");
      return;
    }

    await ensureDefaultUsers();
    await loadUsers();

    const found = usersCache.find((u) => u.username === username);
    if (!found) {
      showMessage(loginError, "اسم المستخدم أو كلمة المرور غير صحيحة.");
      return;
    }
    const hash = await hashPassword(password);
    if (found.passwordHash !== hash) {
      showMessage(loginError, "اسم المستخدم أو كلمة المرور غير صحيحة.");
      return;
    }

    currentUser = {
      username: found.username,
      displayName: found.displayName,
      role: found.role,
      forceChangePassword: !!found.forceChangePassword
    };
    saveSessionLocal(currentUser);

    if (found.role === "admin" && found.forceChangePassword) {
      requirePasswordChange = true;
    } else {
      requirePasswordChange = false;
    }

    enterApp();
  });
}

function enterApp() {
  showScreen("screenHome");
  updateUserBar();
  initTabs();
  initCollapsibles();
  initLogout();
  initMovements();
  initMembers();
  initMessages();
  initStatistics();
  initSettings();
  initGlobalSearch();
  listenMovements();
  listenMessages();

  if (currentUser && currentUser.role === "admin" && currentUser.forceChangePassword) {
    requirePasswordChange = true;
    showView("viewSettings");
    disableTabsExceptSettings(true);
    showToast("Please change your password (Settings).");
  } else {
    requirePasswordChange = false;
    disableTabsExceptSettings(false);
  }
}

function initLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;
  logoutBtn.addEventListener("click", () => {
    clearSessionLocal();
    currentUser = null;
    showScreen("screenLogin");
  });
}

// =========================
// 6) Movements
// =========================
function renderDriverSelect() {
  const select = document.getElementById("movementDriverSelect");
  if (!select) return;
  select.innerHTML = "";
  usersCache.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = `${u.displayName} (${u.username})`;
    select.appendChild(opt);
  });
}

function buildMovementItem(m) {
  const div = document.createElement("div");
  div.className = "list-item";
  div.id = `movement-${m.id}`;

  const header = document.createElement("div");
  header.className = "list-item-header";

  const left = document.createElement("div");
  const badge = document.createElement("span");
  badge.className = "badge " + m.type;
  badge.textContent = m.type === "receive" ? "RECEIVE" : "DELIVER";

  const title = document.createElement("span");
  title.style.marginLeft = "8px";
  title.textContent = `Car ${m.carNumber} - Plate ${m.plate}`;

  left.appendChild(badge);
  left.appendChild(title);

  const right = document.createElement("div");
  right.className = "list-item-meta";
  right.textContent = m.date || "";

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

  const btnShare = document.createElement("button");
  btnShare.className = "action-btn";
  btnShare.textContent = "Share";
  btnShare.addEventListener("click", () => shareMovement(m));

  const btnPrint = document.createElement("button");
  btnPrint.className = "action-btn";
  btnPrint.textContent = "Print";
  btnPrint.addEventListener("click", () => printMovement(m));

  actions.appendChild(btnShare);
  actions.appendChild(btnPrint);

  if (currentUser && currentUser.role === "admin") {
    const btnDelete = document.createElement("button");
    btnDelete.className = "action-btn danger";
    btnDelete.textContent = "Delete";
    btnDelete.addEventListener("click", () => deleteMovement(m.id));
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
  if (!movementsCache || movementsCache.length === 0) {
    container.innerHTML = `<div class="info-text">No movements yet.</div>`;
    return;
  }
  container.innerHTML = "";
  movementsCache
    .slice()
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .reverse()
    .forEach((m) => container.appendChild(buildMovementItem(m)));
}

function initMovements() {
  renderDriverSelect();
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

    const driver = usersCache.find((u) => u.username === driverUsername);
    const now = getGulfNow();
    const movement = {
      type,
      carNumber,
      plate,
      driverUsername,
      driverName: driver ? driver.displayName : driverUsername,
      notes,
      createdBy: currentUser.username,
      createdByDisplayName: currentUser.displayName,
      date: formatDateTime(now),
      createdAt: Date.now()
    };

    const newRef = push(ref(db, "movements"));
    await set(newRef, movement);
    form.reset();
    showMessage(successBox, "Movement saved.", "success");
  });
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
  const text = `Movement\nType: ${m.type}\nCar: ${m.carNumber}\nPlate: ${m.plate}\nDriver: ${m.driverName}\nBy: ${m.createdByDisplayName || m.createdBy}\nDate: ${m.date}\nNotes: ${m.notes || "-"}`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<pre>${text}</pre>`);
  w.print();
  w.close();
}

async function deleteMovement(id) {
  await set(ref(db, `movements/${id}`), null);
}

// =========================
// 7) Members
// =========================
function renderMembersList() {
  const container = document.getElementById("membersList");
  if (!container) return;
  if (!usersCache || usersCache.length === 0) {
    container.innerHTML = `<div class="info-text">No members.</div>`;
    return;
  }
  container.innerHTML = "";
  usersCache.forEach((u) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.id = `member-${u.username}`;
    div.innerHTML = `
      <div class="list-item-header">
        <div>${u.displayName} (${u.username})</div>
        <div class="list-item-meta">${u.role === "admin" ? "Admin" : "User"}</div>
      </div>
      <div class="list-item-meta">Phone: ${u.phone || "-"}</div>
    `;
    container.appendChild(div);
  });
}

function renderMessageTargets() {
  const select = document.getElementById("messageTarget");
  const statsUserSelect = document.getElementById("statsUserSelect");
  if (select) {
    select.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "All";
    select.appendChild(optAll);
  }
  if (statsUserSelect) {
    statsUserSelect.innerHTML = "";
  }
  usersCache.forEach((u) => {
    if (select) {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = `${u.displayName} (${u.username})`;
      select.appendChild(opt);
    }
    if (statsUserSelect) {
      const opt2 = document.createElement("option");
      opt2.value = u.username;
      opt2.textContent = `${u.displayName} (${u.username})`;
      statsUserSelect.appendChild(opt2);
    }
  });
}

function initMembers() {
  const form = document.getElementById("addMemberForm");
  const errorBox = document.getElementById("addMemberError");
  const successBox = document.getElementById("addMemberSuccess");
  if (!form) return;

  renderMembersList();
  renderDriverSelect();
  renderMessageTargets();

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

    if (usersCache.find((u) => u.username === username)) {
      showMessage(errorBox, "Username already exists.");
      return;
    }

    const passwordHash = await hashPassword(password);
    const userObj = {
      username,
      passwordHash,
      displayName,
      phone,
      role,
      forceChangePassword: role === "admin"
    };

    await set(ref(db, `users/${username}`), userObj);
    await loadUsers();
    renderMembersList();
    renderDriverSelect();
    renderMessageTargets();
    form.reset();
    showMessage(successBox, "Member saved.", "success");
  });
}

// =========================
// 8) Messages
// =========================
function renderMessagesList() {
  const container = document.getElementById("messagesList");
  if (!container) return;
  if (!messagesCache || messagesCache.length === 0) {
    container.innerHTML = `<div class="info-text">No messages.</div>`;
    return;
  }
  container.innerHTML = "";
  messagesCache
    .slice()
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .reverse()
    .forEach((msg) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.id = `message-${msg.id}`;
      div.innerHTML = `
        <div class="message-from">${msg.fromDisplayName || msg.fromUsername}</div>
        <div class="message-text">${msg.text}</div>
        <div class="message-meta">${msg.date} | To: ${msg.toLabel}</div>
      `;
      container.appendChild(div);
    });
}

function initMessages() {
  const form = document.getElementById("sendMessageForm");
  const errorBox = document.getElementById("sendMessageError");
  const successBox = document.getElementById("sendMessageSuccess");
  const textArea = document.getElementById("messageText");
  if (!form) return;

  renderMessageTargets();
  renderMessagesList();

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
      const u = usersCache.find((x) => x.username === target);
      toLabel = u ? `${u.displayName} (${u.username})` : target;
    }

    const now = getGulfNow();
    const message = {
      fromUsername: currentUser.username,
      fromDisplayName: currentUser.displayName,
      to: target,
      toLabel,
      text,
      date: formatDateTime(now),
      createdAt: Date.now()
    };

    const newRef = push(ref(db, "messages"));
    await set(newRef, message);
    form.reset();
    showMessage(successBox, "Message sent.", "success");
  });
}

// =========================
// 9) Statistics
// =========================
function updateStatsSummary() {
  const box = document.getElementById("statsSummaryBox");
  if (!box) return;
  const total = movementsCache.length;
  const received = movementsCache.filter((m) => m.type === "receive").length;
  const delivered = movementsCache.filter((m) => m.type === "deliver").length;
  box.innerHTML = `
    <div class="info-text">Total movements: ${total}</div>
    <div class="info-text">Received: ${received}</div>
    <div class="info-text">Delivered: ${delivered}</div>
  `;
}

function initStatistics() {
  updateStatsSummary();

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
      const filtered = movementsCache.filter((m) => {
        const t = new Date(m.date.replace(" ", "T")).getTime();
        return t >= fromTime && t <= toTime;
      });
      rangeResult.textContent = `Movements in range: ${filtered.length}`;
    });
  }

  const formUser = document.getElementById("statsUserForm");
  const userResult = document.getElementById("statsUserResult");
  if (formUser) {
    formUser.addEventListener("submit", (e) => {
      e.preventDefault();
      const selected = document.getElementById("statsUserSelect").value;
      const count = movementsCache.filter(
        (m) => m.createdBy === selected || m.driverUsername === selected
      ).length;
      userResult.textContent = `Movements related to this user: ${count}`;
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
      const count = movementsCache.filter(
        (m) => (m.carNumber || "").toLowerCase() === carNumber.toLowerCase()
      ).length;
      carResult.textContent = `Movements for this car: ${count}`;
    });
  }
}

// =========================
// 10) Settings
// =========================
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

      await loadUsers();
      const idx = usersCache.findIndex((u) => u.username === currentUser.username);
      if (idx === -1) {
        showMessage(passError, "User not found.");
        return;
      }

      const oldHash = await hashPassword(oldPassword);
      if (usersCache[idx].passwordHash !== oldHash) {
        showMessage(passError, "Current password is incorrect.");
        return;
      }

      const newHash = await hashPassword(newPassword);
      const updatedUser = {
        ...usersCache[idx],
        passwordHash: newHash,
        forceChangePassword: false
      };

      await set(ref(db, `users/${currentUser.username}`), updatedUser);
      currentUser.forceChangePassword = false;
      saveSessionLocal(currentUser);
      requirePasswordChange = false;
      disableTabsExceptSettings(false);
      showMessage(passSuccess, "Password updated.", "success");
      passForm.reset();
    });
  }

  if (phoneForm) {
    phoneForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentUser) return;
      const newPhone = document.getElementById("newPhone").value.trim();
      if (!newPhone) {
        showMessage(phoneError, "Please enter phone.");
        return;
      }

      await loadUsers();
      const idx = usersCache.findIndex((u) => u.username === currentUser.username);
      if (idx === -1) {
        showMessage(phoneError, "User not found.");
        return;
      }

      const updatedUser = {
        ...usersCache[idx],
        phone: newPhone
      };

      await set(ref(db, `users/${currentUser.username}`), updatedUser);
      currentUser.phone = newPhone;
      saveSessionLocal(currentUser);
      showMessage(phoneSuccess, "Phone updated.", "success");
      phoneForm.reset();
    });
  }
}

// =========================
// 11) Global search
// =========================
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

  input.addEventListener("input", () => {
    const term = input.value.trim().toLowerCase();
    if (!term) {
      box.innerHTML = "";
      return;
    }

    const results = [];

    movementsCache.forEach((m) => {
      const text = `${m.carNumber} ${m.plate} ${m.driverName} ${m.notes}`.toLowerCase();
      if (text.includes(term)) {
        results.push({
          type: "movement",
          id: m.id,
          label: `Movement: ${m.carNumber} / ${m.plate} / ${m.driverName}`
        });
      }
    });

    usersCache.forEach((u) => {
      const text = `${u.username} ${u.displayName} ${u.phone}`.toLowerCase();
      if (text.includes(term)) {
        results.push({
          type: "member",
          id: u.username,
          label: `Member: ${u.displayName} (${u.username})`
        });
      }
    });

    messagesCache.forEach((msg) => {
      const text = `${msg.text} ${msg.fromDisplayName} ${msg.toLabel}`.toLowerCase();
      if (text.includes(term)) {
        results.push({
          type: "message",
          id: msg.id,
          label: `Message: ${msg.text}`
        });
      }
    });

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

// =========================
// 12) Bootstrap
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  showScreen("screenLogin");
  await ensureDefaultUsers();
  await loadUsers();
  handleLogin();
});
