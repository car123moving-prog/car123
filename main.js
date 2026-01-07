/* ============================================================
   FIREBASE INITIALIZATION (CDN + MODULE)
============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCREnC-6yJX4l1HpFVNNZgOvodBQkEri5g",
  authDomain: "car123-moving.firebaseapp.com",
  projectId: "car123-moving",
  storageBucket: "car123-moving.firebasestorage.app",
  messagingSenderId: "820235378242",
  appId: "1:820235378242:web:94e0907a41a395c8bb17db"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* Collections */
const colUsers = collection(db, "users");
const colMovements = collection(db, "movements");
const colMessages = collection(db, "messages");

/* ============================================================
   GLOBAL CACHES
============================================================ */
let usersCache = [];
let movementsCache = [];
let messagesCache = [];

/* ============================================================
   TIMEZONE +4
============================================================ */
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

/* ============================================================
   SESSION (LOCAL ONLY)
============================================================ */
const SESSION_KEY = "cms_session";

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function getCurrentUser() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/* ============================================================
   UI HELPERS
============================================================ */
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

/* ============================================================
   SEED INITIAL DATA (ADMIN USER)
============================================================ */
async function seedAdminUserIfNeeded() {
  const snap = await getDocs(colUsers);
  if (!snap.empty) {
    usersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return;
  }

  const adminDoc = doc(colUsers, "admin");
  await setDoc(adminDoc, {
    username: "admin",
    password: "1234",
    displayName: "Administrator",
    phone: "",
    role: "admin"
  });

  usersCache = [{ id: "admin", username: "admin", password: "1234", displayName: "Administrator", phone: "", role: "admin" }];
}

/* ============================================================
   LOGIN
============================================================ */
let currentUser = null;

function updateUserBar() {
  const nameEl = document.getElementById("currentUserName");
  const roleEl = document.getElementById("currentUserRole");
  if (!currentUser) return;
  nameEl.textContent = currentUser.displayName || currentUser.username;
  roleEl.textContent = currentUser.role === "admin" ? "Administrator" : "User";
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
  document.querySelectorAll(".collapsible-header").forEach((header) => {
    header.addEventListener("click", () => {
      const targetId = header.getAttribute("data-target");
      const body = document.getElementById(targetId);
      if (!body) return;
      const open = body.classList.contains("open");
      body.classList.toggle("open", !open);
      const indicator = header.querySelector(".collapse-indicator");
      if (indicator) indicator.textContent = open ? "▲" : "▼";
    });
  });
}

async function handleLogin(username, password) {
  const q = query(colUsers, where("username", "==", username), where("password", "==", password));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

function initLogin() {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");

  const existing = getCurrentUser();
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
      showMessage(loginError, "Please enter username and password.");
      return;
    }
    try {
      const user = await handleLogin(username, password);
      if (!user) {
        showMessage(loginError, "Invalid username or password.");
        return;
      }
      currentUser = user;
      saveSession(user);
      enterApp();
    } catch {
      showMessage(loginError, "Login error. Try again.");
    }
  });
}

/* ============================================================
   ENTER APP
============================================================ */
function enterApp() {
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
}

/* ============================================================
   MOVEMENTS
============================================================ */
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

function renderMovementsList() {
  const container = document.getElementById("movementsList");
  if (!container) return;

  if (movementsCache.length === 0) {
    container.innerHTML = `<div class="info-text">No movements yet.</div>`;
    return;
  }

  container.innerHTML = "";

  movementsCache
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((m) => {
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
      title.style.marginLeft = "6px";
      title.textContent = `Car ${m.carNumber} - Plate ${m.plate}`;

      left.appendChild(badge);
      left.appendChild(title);

      const right = document.createElement("div");
      right.className = "list-item-meta";
      right.textContent = m.date;

      header.appendChild(left);
      header.appendChild(right);

      const meta = document.createElement("div");
      meta.className = "list-item-meta";
      meta.textContent = `Driver: ${m.driverName} | By: ${m.createdBy}`;

      const notes = document.createElement("div");
      notes.className = "message-text";
      notes.textContent = m.notes || "-";

      const actions = document.createElement("div");
      actions.className = "list-item-actions";

      const btnEdit = document.createElement("button");
      btnEdit.className = "action-btn";
      btnEdit.textContent = "Edit";
      btnEdit.addEventListener("click", () => editMovement(m.id));

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
      btnDelete.addEventListener("click", () => deleteMovement(m.id));

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

      container.appendChild(div);
    });
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
    const driverName = driver ? driver.displayName : driverUsername;
    const now = getGulfNow();

    try {
      await addDoc(colMovements, {
        type,
        carNumber,
        plate,
        driverUsername,
        driverName,
        notes,
        createdBy: currentUser.username,
        date: formatDateTime(now),
        createdAt: now.getTime()
      });
      form.reset();
      renderDriverSelect();
      showMessage(successBox, "Movement saved.", "success");
    } catch {
      showMessage(errorBox, "Error saving movement.");
    }
  });

  const qMov = query(colMovements, orderBy("createdAt", "desc"));
  onSnapshot(qMov, (snap) => {
    movementsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMovementsList();
    updateStatsSummary();
  });
}

async function editMovement(id) {
  const m = movementsCache.find((x) => x.id === id);
  if (!m) return;

  document.getElementById("movementType").value = m.type;
  document.getElementById("movementCarNumber").value = m.carNumber;
  document.getElementById("movementPlate").value = m.plate;
  document.getElementById("movementNotes").value = m.notes || "";
  document.getElementById("movementDriverSelect").value = m.driverUsername;

  await deleteMovement(id, false);
  showView("viewMovements");
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

async function deleteMovement(id, rerender = true) {
  await deleteDoc(doc(colMovements, id));
  if (rerender) renderMovementsList();
}

/* ============================================================
   MEMBERS
============================================================ */
function renderMembersList() {
  const container = document.getElementById("membersList");
  if (!container) return;

  if (usersCache.length === 0) {
    container.innerHTML = `<div class="info-text">No members.</div>`;
    return;
  }

  container.innerHTML = "";

  usersCache.forEach((u) => {
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

function renderMessageTargets() {
  const select = document.getElementById("messageTarget");
  if (!select) return;

  select.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All";
  select.appendChild(optAll);

  usersCache.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = `${u.displayName} (${u.username})`;
    select.appendChild(opt);
  });
}

function renderStatsUsers() {
  const select = document.getElementById("statsUserSelect");
  if (!select) return;

  select.innerHTML = "";
  usersCache.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = `${u.displayName} (${u.username})`;
    select.appendChild(opt);
  });
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

    try {
      await addDoc(colUsers, { username, password, displayName, phone, role });
      form.reset();
      showMessage(successBox, "Member saved.", "success");
    } catch {
      showMessage(errorBox, "Error saving member.");
    }
  });

  const qUsers = query(colUsers, orderBy("username"));
  onSnapshot(qUsers, (snap) => {
    usersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMembersList();
    renderDriverSelect();
    renderMessageTargets();
    renderStatsUsers();
  });
}

/* ============================================================
   MESSAGES
============================================================ */
function renderMessagesList() {
  const container = document.getElementById("messagesList");
  if (!container) return;

  if (messagesCache.length === 0) {
    container.innerHTML = `<div class="info-text">No messages.</div>`;
    return;
  }

  container.innerHTML = "";

  messagesCache
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((msg) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.id = `message-${msg.id}`;

      const from = document.createElement("div");
      from.className = "message-from";
      from.textContent = `From: ${msg.from}`;

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

    try {
      await addDoc(colMessages, {
        from: currentUser.displayName || currentUser.username,
        to: target,
        toLabel,
        text,
        date: formatDateTime(now),
        createdAt: now.getTime()
      });
      form.reset();
      showMessage(successBox, "Message sent.", "success");
    } catch {
      showMessage(errorBox, "Error sending message.");
    }
  });

  const qMsg = query(colMessages, orderBy("createdAt", "desc"));
  onSnapshot(qMsg, (snap) => {
    messagesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMessagesList();
  });
}

/* ============================================================
   STATISTICS
============================================================ */
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
      const filtered = movementsCache.filter((m) => {
        return m.createdAt >= fromTime && m.createdAt <= toTime;
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
        (m) => m.carNumber.toLowerCase() === carNumber.toLowerCase()
      ).length;
      carResult.textContent = `Movements for this car: ${count}`;
    });
  }
}

/* ============================================================
   SETTINGS
============================================================ */
function initSettings() {
  const passForm = document.getElementById("changePasswordForm");
  const passError = document.getElementById("changePasswordError");
  const passSuccess = document.getElementById("changePasswordSuccess");

  if (passForm) {
    passForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      const oldPassword = document.getElementById("oldPassword").value.trim();
      const newPassword = document.getElementById("newPassword").value.trim();
      const confirmPassword = document
        .getElementById("confirmPassword")
        .value.trim();

      if (!oldPassword || !newPassword || !confirmPassword) {
        showMessage(passError, "Please fill all fields.");
        return;
      }

      if (newPassword !== confirmPassword) {
        showMessage(passError, "New passwords do not match.");
        return;
      }

      const userDoc = usersCache.find((u) => u.username === currentUser.username);
      if (!userDoc) {
        showMessage(passError, "User not found.");
        return;
      }

      if (userDoc.password !== oldPassword) {
        showMessage(passError, "Current password is incorrect.");
        return;
      }

      try {
        await updateDoc(doc(colUsers, userDoc.id), { password: newPassword });
        currentUser.password = newPassword;
        saveSession(currentUser);
        showMessage(passSuccess, "Password updated.", "success");
        passForm.reset();
      } catch {
        showMessage(passError, "Error updating password.");
      }
    });
  }

  const phoneForm = document.getElementById("changePhoneForm");
  const phoneError = document.getElementById("changePhoneError");
  const phoneSuccess = document.getElementById("changePhoneSuccess");

  if (phoneForm) {
    phoneForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      const newPhone = document.getElementById("newPhone").value.trim();
      if (!newPhone) {
        showMessage(phoneError, "Please enter phone.");
        return;
      }

      const userDoc = usersCache.find((u) => u.username === currentUser.username);
      if (!userDoc) {
        showMessage(phoneError, "User not found.");
        return;
      }

      try {
        await updateDoc(doc(colUsers, userDoc.id), { phone: newPhone });
        currentUser.phone = newPhone;
        saveSession(currentUser);
        showMessage(phoneSuccess, "Phone updated.", "success");
        phoneForm.reset();
      } catch {
        showMessage(phoneError, "Error updating phone.");
      }
    });
  }
}

/* ============================================================
   GLOBAL SEARCH
============================================================ */
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
          label: `Movement: ${m.carNumber} / ${m.plate} / ${m.driverName}`,
        });
      }
    });

    usersCache.forEach((u) => {
      const text = `${u.username} ${u.displayName} ${u.phone}`.toLowerCase();
      if (text.includes(term)) {
        results.push({
          type: "member",
          id: u.username,
          label: `Member: ${u.displayName} (${u.username})`,
        });
      }
    });

    messagesCache.forEach((msg) => {
      const text = `${msg.text} ${msg.from} ${msg.toLabel}`.toLowerCase();
      if (text.includes(term)) {
        results.push({
          type: "message",
          id: msg.id,
          label: `Message: ${msg.text}`,
        });
      }
    });

    if (results.length === 0) {
      box.innerHTML = `<div class="search-result-item">No results.</div>`;
      return;
    }

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
        }

        if (r.type === "member") {
          showView("viewMembers");
          setTimeout(() => {
            const el = document.getElementById(`member-${r.id}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 50);
        }

        if (r.type === "message") {
          showView("viewMessages");
          setTimeout(() => {
            const el = document.getElementById(`message-${r.id}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 50);
        }
      });

      box.appendChild(div);
    });
  });
}

/* ============================================================
   LOGOUT
============================================================ */
function initLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;
  logoutBtn.addEventListener("click", () => {
    clearSession();
    currentUser = null;
    showScreen("screenLogin");
  });
}

/* ============================================================
   PWA REGISTRATION
============================================================ */
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js", { scope: "./" })
      .catch(() => {});
  }
}

/* ============================================================
   MAIN ENTRY
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  await seedAdminUserIfNeeded();
  registerServiceWorker();
  initLogin();
});
