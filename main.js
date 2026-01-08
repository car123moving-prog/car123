// main.js — English UI, roles, edit, toast, Realtime DB

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

// Helpers
async function hashPassword(password) {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
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

function showToast(message) {
  let box = document.getElementById("toastBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    box.style.position = "fixed";
    box.style.bottom = "20px";
    box.style.right = "20px";
    box.style.zIndex = "999999";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";
    document.body.appendChild(box);
  }

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.background = "#0b3c6f";
  toast.style.color = "#fff";
  toast.style.padding = "14px 18px";
  toast.style.borderRadius = "10px";
  toast.style.fontSize = "15px";
  toast.style.boxShadow = "0 6px 18px rgba(0,0,0,0.25)";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.3s ease";

  box.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
  }, 50);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// State
let currentUser = null;
let requirePasswordChange = false;
let movementsCache = [];
let usersCache = [];
let messagesCache = [];

// Firebase helpers
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
    updateStatsSummary();
  });
}

function listenMessages() {
  const messagesRef = ref(db, "messages");
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

  onChildAdded(messagesRef, (snapshot) => {
    const msg = snapshot.val();
    if (!currentUser) return;
    if (msg.fromUsername === currentUser.username) return;
    showToast(`New message from ${msg.fromDisplayName || msg.fromUsername}`);
  });
}

// Session
function saveSessionLocal(user) {
  const safe = {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    forceChangePassword: !!user.forceChangePassword,
    phone: user.phone || ""
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

function applyRoleVisibility() {
  const isAdmin = currentUser && currentUser.role === "admin";
  const membersTab = document.querySelector('.tab-btn[data-view="viewMembers"]');
  const statsTab = document.querySelector('.tab-btn[data-view="viewStatistics"]');
  const settingsTab = document.querySelector('.tab-btn[data-view="viewSettings"]');

  if (membersTab) membersTab.style.display = isAdmin ? "" : "none";
  if (statsTab) statsTab.style.display = isAdmin ? "" : "none";
  if (settingsTab) settingsTab.style.display = isAdmin ? "" : "none";

  if (!isAdmin) {
    if (document.getElementById("viewMembers").classList.contains("active") ||
        document.getElementById("viewStatistics").classList.contains("active") ||
        document.getElementById("viewSettings").classList.contains("active")) {
      showView("viewMovements");
    }
  }
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

// UI init
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!currentUser) return;
      if (requirePasswordChange && btn.dataset.view !== "viewSettings") return;
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

  const addMovementBody = document.getElementById("addMovementBody");
  if (addMovementBody) addMovementBody.classList.add("open");
}

// Login
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
      showMessage(loginError, "Please enter username and password.");
      return;
    }

    await ensureDefaultUsers();
    await loadUsers();

    const found = usersCache.find((u) => u.username === username);
    if (!found) {
      showMessage(loginError, "Invalid username or password.");
      return;
    }
    const hash = await hashPassword(password);
    if (found.passwordHash !== hash) {
      showMessage(loginError, "Invalid username or password.");
      return;
    }

    currentUser = {
      username: found.username,
      displayName: found.displayName,
      role: found.role,
      forceChangePassword: !!found.forceChangePassword,
      phone: found.phone || ""
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
  applyRoleVisibility();
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
    showToast("Please change your password in Settings.");
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

// Movements

function renderDriverSelect() {
  const select = document.getElementById("movementDriverSelect");
  const editSelect = document.getElementById("editMovementDriverSelect");
  if (select) select.innerHTML = "";
  if (editSelect) editSelect.innerHTML = "";
  usersCache.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = `${u.displayName} (${u.username})`;
    if (select) select.appendChild(opt.cloneNode(true));
    if (editSelect) editSelect.appendChild(opt);
  });
}

// helper: can current user see this movement?
function canSeeMovement(m) {
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  const u = currentUser.username;
  return (
    m.createdBy === u ||
    m.driverUsername === u ||
    m.assignedTo === u
  );
}

// helper: can current user edit notes of this movement?
function canEditNotes(m) {
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;

  const u = currentUser.username;
  const related =
    m.createdBy === u ||
    m.driverUsername === u ||
    m.assignedTo === u;

  if (!related) return false;

  const lastTime = m.notesUpdatedAt || m.createdAt || 0;
  const now = Date.now();
  const diff = now - lastTime;
  const limit = 24 * 60 * 60 * 1000; // 24 hours
  return diff <= limit;
}

// notes modal state
let notesModalEl = null;
let notesModalTextarea = null;
let notesModalError = null;
let notesModalSaveBtn = null;
let notesModalCloseBtn = null;
let notesModalMovementId = null;

function ensureNotesModal() {
  if (notesModalEl) return;

  notesModalEl = document.createElement("div");
  notesModalEl.id = "editNotesModal";
  notesModalEl.style.position = "fixed";
  notesModalEl.style.top = "0";
  notesModalEl.style.left = "0";
  notesModalEl.style.width = "100%";
  notesModalEl.style.height = "100%";
  notesModalEl.style.background = "rgba(0,0,0,0.4)";
  notesModalEl.style.display = "none";
  notesModalEl.style.alignItems = "center";
  notesModalEl.style.justifyContent = "center";
  notesModalEl.style.zIndex = "99999";

  const inner = document.createElement("div");
  inner.style.background = "#fff";
  inner.style.padding = "20px";
  inner.style.borderRadius = "10px";
  inner.style.width = "90%";
  inner.style.maxWidth = "500px";
  inner.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
  inner.style.display = "flex";
  inner.style.flexDirection = "column";
  inner.style.gap = "10px";

  const title = document.createElement("div");
  title.textContent = "Edit Notes";
  title.style.fontWeight = "600";
  title.style.marginBottom = "5px";

  notesModalTextarea = document.createElement("textarea");
  notesModalTextarea.style.width = "100%";
  notesModalTextarea.style.minHeight = "120px";
  notesModalTextarea.style.padding = "8px";
  notesModalTextarea.style.borderRadius = "6px";
  notesModalTextarea.style.border = "1px solid #ccc";
  notesModalTextarea.style.fontFamily = "inherit";
  notesModalTextarea.style.fontSize = "14px";

  notesModalError = document.createElement("div");
  notesModalError.style.color = "#b00020";
  notesModalError.style.fontSize = "13px";
  notesModalError.textContent = "";

  const actionsRow = document.createElement("div");
  actionsRow.style.display = "flex";
  actionsRow.style.justifyContent = "flex-end";
  actionsRow.style.gap = "10px";
  actionsRow.style.marginTop = "10px";

  notesModalCloseBtn = document.createElement("button");
  notesModalCloseBtn.textContent = "Cancel";
  notesModalCloseBtn.className = "action-btn";
  notesModalCloseBtn.addEventListener("click", () => {
    notesModalEl.style.display = "none";
    notesModalMovementId = null;
    notesModalTextarea.value = "";
    notesModalError.textContent = "";
  });

  notesModalSaveBtn = document.createElement("button");
  notesModalSaveBtn.textContent = "Save";
  notesModalSaveBtn.className = "action-btn";
  notesModalSaveBtn.style.background = "#0b3c6f";
  notesModalSaveBtn.style.color = "#fff";
  notesModalSaveBtn.addEventListener("click", async () => {
    if (!notesModalMovementId || !currentUser) return;
    const newNotes = notesModalTextarea.value.trim();
    if (!newNotes) {
      notesModalError.textContent = "Notes cannot be empty.";
      return;
    }
    const existing = movementsCache.find((m) => m.id === notesModalMovementId);
    if (!existing) {
      notesModalError.textContent = "Movement not found.";
      return;
    }
    if (!canEditNotes(existing)) {
      notesModalError.textContent = "You are not allowed to edit these notes.";
      return;
    }

    const now = getGulfNow();
    const history = Array.isArray(existing.notesHistory)
      ? existing.notesHistory.slice()
      : [];

    history.push({
      text: newNotes,
      by: currentUser.displayName || currentUser.username,
      at: formatDateTime(now)
    });

    const updated = {
      ...existing,
      notes: newNotes,
      notesHistory: history,
      notesUpdatedAt: Date.now(),
      notesUpdatedBy: currentUser.username
    };

    await set(ref(db, `movements/${existing.id}`), updated);
    notesModalEl.style.display = "none";
    notesModalMovementId = null;
    notesModalTextarea.value = "";
    notesModalError.textContent = "";
    showToast("Notes updated.");
  });

  actionsRow.appendChild(notesModalCloseBtn);
  actionsRow.appendChild(notesModalSaveBtn);

  inner.appendChild(title);
  inner.appendChild(notesModalTextarea);
  inner.appendChild(notesModalError);
  inner.appendChild(actionsRow);

  notesModalEl.appendChild(inner);
  document.body.appendChild(notesModalEl);
}

function openEditNotesPopup(m) {
  if (!currentUser) return;
  if (!canEditNotes(m)) {
    showToast("You are not allowed to edit these notes.");
    return;
  }
  ensureNotesModal();
  notesModalMovementId = m.id;
  notesModalTextarea.value = m.notes || "";
  notesModalError.textContent = "";
  notesModalEl.style.display = "flex";
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
  const driverLabel = m.driverName || m.driverUsername;
  const createdByLabel = m.createdByDisplayName || m.createdBy;
  const assignedToLabel = m.assignedTo
    ? ` | Assigned to: ${m.assignedTo}`
    : "";
  meta.textContent = `Driver: ${driverLabel} | By: ${createdByLabel}${assignedToLabel}`;

  const notes = document.createElement("div");
  notes.className = "message-text";
  notes.textContent = m.notes || "-";

  // Edit Notes button under notes (choice A)
  const notesActions = document.createElement("div");
  notesActions.style.marginTop = "6px";
  if (currentUser && canEditNotes(m)) {
    const btnEditNotes = document.createElement("button");
    btnEditNotes.className = "action-btn";
    btnEditNotes.textContent = "Edit Notes";
    btnEditNotes.addEventListener("click", () => openEditNotesPopup(m));
    notesActions.appendChild(btnEditNotes);
  }

  // History block
  const historyBlock = document.createElement("div");
  historyBlock.className = "list-item-meta";
  historyBlock.style.marginTop = "6px";
  if (Array.isArray(m.notesHistory) && m.notesHistory.length > 0) {
    const titleHist = document.createElement("div");
    titleHist.textContent = "Notes history:";
    titleHist.style.fontWeight = "500";
    titleHist.style.marginBottom = "2px";

    const list = document.createElement("ul");
    list.style.paddingLeft = "18px";
    list.style.margin = "0";

    m.notesHistory.forEach((h) => {
      const li = document.createElement("li");
      li.style.fontSize = "12px";
      li.textContent = `${h.at} — ${h.by}: ${h.text}`;
      list.appendChild(li);
    });

    historyBlock.appendChild(titleHist);
    historyBlock.appendChild(list);
  }

  const actions = document.createElement("div");
  actions.className = "list-item-actions";

  if (currentUser && currentUser.role === "admin") {
    const btnEdit = document.createElement("button");
    btnEdit.className = "action-btn";
    btnEdit.textContent = "Edit";
    btnEdit.addEventListener("click", () => openEditMovementModal(m));
    actions.appendChild(btnEdit);
  }

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

  // Delete removed completely (no soft/hard delete)

  div.appendChild(header);
  div.appendChild(meta);
  div.appendChild(notes);
  div.appendChild(notesActions);
  if (historyBlock.childNodes.length > 0) {
    div.appendChild(historyBlock);
  }
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

  let list = movementsCache.slice();

  if (currentUser && currentUser.role !== "admin") {
    list = list.filter((m) => canSeeMovement(m));
  }

  list
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .reverse()
    .forEach((m) => container.appendChild(buildMovementItem(m)));
}

function initMovements() {
  renderDriverSelect();
  ensureNotesModal();

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
    const createdAt = Date.now();

    const history = [];
    if (notes) {
      history.push({
        text: notes,
        by: currentUser.displayName || currentUser.username,
        at: formatDateTime(now)
      });
    }

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
      createdAt,
      assignedTo: driverUsername, // initial assignment = driver
      notesHistory: history,
      notesUpdatedAt: createdAt,
      notesUpdatedBy: currentUser.username
    };

    const newRef = push(ref(db, "movements"));
    await set(newRef, movement);
    form.reset();
    showMessage(successBox, "Movement saved.", "success");
  });

  initEditMovementModal();
}

function openEditMovementModal(m) {
  const modal = document.getElementById("editMovementModal");
  if (!modal) return;
  document.getElementById("editMovementId").value = m.id;
  document.getElementById("editMovementType").value = m.type;
  document.getElementById("editMovementCarNumber").value = m.carNumber;
  document.getElementById("editMovementPlate").value = m.plate;
  document.getElementById("editMovementDriverSelect").value = m.driverUsername;
  document.getElementById("editMovementNotes").value = m.notes || "";
  modal.classList.add("active");
}

function initEditMovementModal() {
  const modal = document.getElementById("editMovementModal");
  const closeBtn = document.getElementById("closeEditMovementBtn");
  const form = document.getElementById("editMovementForm");
  const errorBox = document.getElementById("editMovementError");
  const successBox = document.getElementById("editMovementSuccess");
  if (!modal || !closeBtn || !form) return;

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;

    const id = document.getElementById("editMovementId").value;
    const type = document.getElementById("editMovementType").value;
    const carNumber = document.getElementById("editMovementCarNumber").value.trim();
    const plate = document.getElementById("editMovementPlate").value.trim();
    const driverUsername = document.getElementById("editMovementDriverSelect").value;
    const notes = document.getElementById("editMovementNotes").value.trim();

    if (!carNumber || !plate || !driverUsername) {
      showMessage(errorBox, "Please fill required fields.");
      return;
    }

    const driver = usersCache.find((u) => u.username === driverUsername);
    const existing = movementsCache.find((m) => m.id === id);
    if (!existing) {
      showMessage(errorBox, "Movement not found.");
      return;
    }

    // preserve notes history and notesUpdatedAt if notes didn't change
    let history = Array.isArray(existing.notesHistory)
      ? existing.notesHistory.slice()
      : [];
    let notesUpdatedAt = existing.notesUpdatedAt || existing.createdAt || Date.now();
    let notesUpdatedBy = existing.notesUpdatedBy || existing.createdBy;

    if (notes !== (existing.notes || "")) {
      const now = getGulfNow();
      history.push({
        text: notes,
        by: currentUser.displayName || currentUser.username,
        at: formatDateTime(now)
      });
      notesUpdatedAt = Date.now();
      notesUpdatedBy = currentUser.username;
    }

    const updated = {
      ...existing,
      type,
      carNumber,
      plate,
      driverUsername,
      driverName: driver ? driver.displayName : driverUsername,
      notes,
      assignedTo: existing.assignedTo || driverUsername,
      notesHistory: history,
      notesUpdatedAt,
      notesUpdatedBy
    };

    await set(ref(db, `movements/${id}`), updated);
    showMessage(successBox, "Movement updated.", "success");
    setTimeout(() => {
      modal.classList.remove("active");
      form.reset();
    }, 800);
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
  const text = `Movement
Type: ${m.type}
Car: ${m.carNumber}
Plate: ${m.plate}
Driver: ${m.driverName}
By: ${m.createdByDisplayName || m.createdBy}
Date: ${m.date}
Notes: ${m.notes || "-"}`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<pre>${text}</pre>`);
  w.print();
  w.close();
}

// Members
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
    if (!currentUser || currentUser.role !== "admin") {
      showMessage(errorBox, "Only admin can add members.");
      return;
    }
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

// Messages
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

// Statistics
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

// Settings
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

// Global search
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

// Bootstrap
document.addEventListener("DOMContentLoaded", async () => {
  showScreen("screenLogin");
  await ensureDefaultUsers();
  await loadUsers();
  handleLogin();
});
