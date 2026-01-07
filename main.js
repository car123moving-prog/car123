/* --- MAIN.JS — PART 1 START --- */

/* ============================================================
   Car Movement System — Version v1.1
   Full English UI
   Role-based permissions
   Notes editing rules (Admin unlimited / User 24h)
   Internal history tracking
   Freeze accounts
   No deletion anywhere
   Messages: User → Admin only
   Footer: © 2026 — Developed by MOHAMED SAAD
   ============================================================ */

/* -----------------------------
   Firebase Initialization
------------------------------ */

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

/* -----------------------------
   Global State
------------------------------ */

let currentUser = null;              // Logged-in user
let requirePasswordChange = false;   // Admin first login
let movementsCache = [];             // All movements
let usersCache = [];                 // All users
let messagesCache = [];              // All messages

/* -----------------------------
   Utility: Hash Password
------------------------------ */

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

/* -----------------------------
   Utility: Gulf Time
------------------------------ */

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

/* -----------------------------
   Utility: Toast
------------------------------ */

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

/* -----------------------------
   Utility: Show Message
------------------------------ */

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

/* -----------------------------
   Screen Switching
------------------------------ */

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

/* -----------------------------
   Session Handling
------------------------------ */

function saveSessionLocal(user) {
  const safe = {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    forceChangePassword: !!user.forceChangePassword,
    frozen: !!user.frozen
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

/* -----------------------------
   Footer Injection
------------------------------ */

function injectFooter() {
  const footer = document.createElement("div");
  footer.style.textAlign = "center";
  footer.style.padding = "12px";
  footer.style.fontSize = "13px";
  footer.style.color = "#6b7280";
  footer.style.marginTop = "40px";
  footer.innerHTML = "© 2026 — Developed by <strong>MOHAMED SAAD</strong>";
  document.body.appendChild(footer);
}

/* --- MAIN.JS — PART 1 END --- */

/* --- MAIN.JS — PART 2 START --- */

/* ============================================================
   USERS LOADING + FREEZE SYSTEM
   ============================================================ */

/* -----------------------------
   Load All Users
------------------------------ */

async function loadUsers() {
  const snap = await get(ref(db, "users"));
  usersCache = [];
  if (snap.exists()) {
    const val = snap.val();
    usersCache = Object.values(val);
  }
}

/* -----------------------------
   Ensure Default Users (Admin + User)
------------------------------ */

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
      frozen: false,
      forceChangePassword: true
    };

    updates["users/user1"] = {
      username: "user1",
      passwordHash: userHash,
      displayName: "User One",
      phone: "",
      role: "user",
      frozen: false,
      forceChangePassword: false
    };

    await update(ref(db), updates);
  }
}

/* ============================================================
   MOVEMENTS LOADING
   ============================================================ */

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

/* ============================================================
   MESSAGES LOADING
   ============================================================ */

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

  /* Toast for new messages */
  onChildAdded(messagesRef, (snapshot) => {
    const msg = snapshot.val();
    if (!currentUser) return;

    /* Do not notify for own messages */
    if (msg.fromUsername === currentUser.username) return;

    /* User only receives messages from admin */
    if (currentUser.role === "user" && msg.fromUsername !== "admin") return;

    showToast(`New message from ${msg.fromDisplayName || msg.fromUsername}`);
  });
}

/* ============================================================
   ROLE SYSTEM + FREEZE SYSTEM
   ============================================================ */

/* -----------------------------
   Update User Bar
------------------------------ */

function updateUserBar() {
  const nameEl = document.getElementById("currentUserName");
  const roleEl = document.getElementById("currentUserRole");

  if (!currentUser) return;

  nameEl.textContent = currentUser.displayName || currentUser.username;

  if (currentUser.frozen) {
    roleEl.textContent = "Frozen Account";
    roleEl.style.color = "red";
  } else {
    roleEl.textContent = currentUser.role === "admin" ? "Administrator" : "User";
    roleEl.style.color = "";
  }
}

/* -----------------------------
   Apply Role Visibility
------------------------------ */

function applyRoleVisibility() {
  const isAdmin = currentUser && currentUser.role === "admin";

  const membersTab = document.querySelector('.tab-btn[data-view="viewMembers"]');
  const statsTab = document.querySelector('.tab-btn[data-view="viewStatistics"]');
  const settingsTab = document.querySelector('.tab-btn[data-view="viewSettings"]');

  if (membersTab) membersTab.style.display = isAdmin ? "" : "none";
  if (statsTab) statsTab.style.display = isAdmin ? "" : "none";
  if (settingsTab) settingsTab.style.display = isAdmin ? "" : "none";

  if (!isAdmin) {
    if (
      document.getElementById("viewMembers").classList.contains("active") ||
      document.getElementById("viewStatistics").classList.contains("active") ||
      document.getElementById("viewSettings").classList.contains("active")
    ) {
      showView("viewMovements");
    }
  }
}

/* -----------------------------
   Disable Tabs Except Settings
------------------------------ */

function disableTabsExceptSettings(disable) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    if (btn.dataset.view !== "viewSettings") {
      btn.disabled = disable;
      btn.style.pointerEvents = disable ? "none" : "";
      btn.style.opacity = disable ? "0.5" : "";
    }
  });
}

/* ============================================================
   LOGIN SYSTEM + FREEZE CHECK
   ============================================================ */

async function handleLogin() {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");

  const existing = getSessionLocal();
  if (existing) {
    currentUser = existing;

    /* Frozen check */
    if (currentUser.frozen) {
      showMessage(loginError, "Your account is frozen. Contact the administrator.");
      clearSessionLocal();
      return;
    }

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

    /* Frozen check */
    if (found.frozen) {
      showMessage(loginError, "Your account is frozen. Contact the administrator.");
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
      frozen: found.frozen,
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

/* ============================================================
   ENTER APP
   ============================================================ */

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
  injectFooter();

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

/* --- MAIN.JS — PART 2 END --- */

/* --- MAIN.JS — PART 3 START --- */

/* ============================================================
   MOVEMENTS — ADD, EDIT NOTES, HISTORY, ROLE FILTERING
   ============================================================ */

/* -----------------------------
   Initialize Movements Section
------------------------------ */

function initMovements() {
  const form = document.getElementById("movementForm");
  const errorEl = document.getElementById("movementError");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const driver = document.getElementById("movementDriver").value.trim();
    const plate = document.getElementById("movementPlate").value.trim();
    const destination = document.getElementById("movementDestination").value.trim();
    const notes = document.getElementById("movementNotes").value.trim();

    if (!driver || !plate || !destination) {
      showMessage(errorEl, "Please fill all required fields.");
      return;
    }

    const now = getGulfNow();
    const movementId = push(ref(db, "movements")).key;

    const movementData = {
      id: movementId,
      driver,
      plate,
      destination,
      notes,
      createdAt: formatDateTime(now),
      createdBy: currentUser.username,
      createdByName: currentUser.displayName,
      history: []  // internal history
    };

    await set(ref(db, "movements/" + movementId), movementData);

    form.reset();
    showToast("Movement added successfully.");
  });
}

/* ============================================================
   RENDER MOVEMENTS LIST
   ============================================================ */

function renderMovementsList() {
  const container = document.getElementById("movementsList");
  if (!container) return;

  container.innerHTML = "";

  let list = [];

  if (currentUser.role === "admin") {
    list = movementsCache;
  } else {
    list = movementsCache.filter(
      (m) => m.createdBy === currentUser.username
    );
  }

  list.sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  list.forEach((m) => {
    const card = document.createElement("div");
    card.className = "movement-card";

    const hasEdits = m.history && m.history.length > 0;

    let notesSection = `
      <div class="movement-notes">
        <strong>Notes:</strong> ${m.notes || ""}
      </div>
    `;

    if (hasEdits) {
      const lastEdit = m.history[m.history.length - 1];
      notesSection = `
        <div class="movement-notes">
          <strong>Notes (edited):</strong><br>
          <div class="edit-block">
            <div><strong>Original:</strong> ${lastEdit.original}</div>
            <div><strong>Updated:</strong> ${lastEdit.updated}</div>
            <div><strong>Edited by:</strong> ${lastEdit.editedByName}</div>
            <div><strong>Edited at:</strong> ${lastEdit.editedAt}</div>
          </div>
          <div class="history-flag">This record contains edit history</div>
        </div>
      `;
    }

    const canEdit = canEditMovementNotes(m);

    card.innerHTML = `
      <div class="movement-header">
        <div><strong>Driver:</strong> ${m.driver}</div>
        <div><strong>Plate:</strong> ${m.plate}</div>
      </div>

      <div><strong>Destination:</strong> ${m.destination}</div>
      <div><strong>Created at:</strong> ${m.createdAt}</div>
      <div><strong>Created by:</strong> ${m.createdByName}</div>

      ${notesSection}

      ${
        canEdit
          ? `<button class="edit-btn" onclick="openEditNotes('${m.id}')">Edit Notes</button>`
          : ""
      }
    `;

    container.appendChild(card);
  });
}

/* ============================================================
   CHECK EDIT PERMISSION
   ============================================================ */

function canEditMovementNotes(m) {
  if (!currentUser) return false;

  if (currentUser.role === "admin") return true;

  if (m.createdBy !== currentUser.username) return false;

  const createdTime = new Date(m.createdAt).getTime();
  const now = getGulfNow().getTime();
  const diffHours = (now - createdTime) / (1000 * 60 * 60);

  return diffHours <= 24;
}

/* ============================================================
   OPEN EDIT NOTES POPUP
   ============================================================ */

function openEditNotes(id) {
  const m = movementsCache.find((x) => x.id === id);
  if (!m) return;

  const popup = document.getElementById("editNotesPopup");
  const textarea = document.getElementById("editNotesText");
  const saveBtn = document.getElementById("editNotesSave");

  textarea.value = m.notes || "";
  popup.style.display = "flex";

  saveBtn.onclick = () => saveEditedNotes(id);
}

/* ============================================================
   SAVE EDITED NOTES
   ============================================================ */

async function saveEditedNotes(id) {
  const m = movementsCache.find((x) => x.id === id);
  if (!m) return;

  const newNotes = document.getElementById("editNotesText").value.trim();
  const popup = document.getElementById("editNotesPopup");

  const now = getGulfNow();

  const historyEntry = {
    original: m.notes || "",
    updated: newNotes,
    editedBy: currentUser.username,
    editedByName: currentUser.displayName,
    editedAt: formatDateTime(now)
  };

  const updatedMovement = {
    ...m,
    notes: newNotes,
    history: [...(m.history || []), historyEntry]
  };

  await update(ref(db, "movements/" + id), updatedMovement);

  popup.style.display = "none";
  showToast("Notes updated successfully.");
}

/* ============================================================
   CLOSE EDIT POPUP
   ============================================================ */

function closeEditNotesPopup() {
  document.getElementById("editNotesPopup").style.display = "none";
}

/* --- MAIN.JS — PART 3 END --- */

/* --- MAIN.JS — PART 4 START --- */

/* ============================================================
   MESSAGES — SEND, RECEIVE, ROLE FILTERING
   ============================================================ */

/* -----------------------------
   Initialize Messages Section
------------------------------ */

function initMessages() {
  const form = document.getElementById("messageForm");
  const errorEl = document.getElementById("messageError");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = document.getElementById("messageText").value.trim();
    const target = document.getElementById("messageTarget").value;

    if (!text) {
      showMessage(errorEl, "Message cannot be empty.");
      return;
    }

    const now = getGulfNow();
    const msgId = push(ref(db, "messages")).key;

    let toUsername = "admin";
    let toDisplayName = "Administrator";

    if (currentUser.role === "admin") {
      if (target === "all") {
        toUsername = "all";
        toDisplayName = "All Users";
      } else {
        const user = usersCache.find((u) => u.username === target);
        if (user) {
          toUsername = user.username;
          toDisplayName = user.displayName;
        }
      }
    }

    const msgData = {
      id: msgId,
      text,
      fromUsername: currentUser.username,
      fromDisplayName: currentUser.displayName,
      toUsername,
      toDisplayName,
      createdAt: formatDateTime(now)
    };

    await set(ref(db, "messages/" + msgId), msgData);

    document.getElementById("messageText").value = "";
    showToast("Message sent.");
  });

  updateMessageTargets();
}

/* -----------------------------
   Update Message Targets (Admin Only)
------------------------------ */

function updateMessageTargets() {
  const select = document.getElementById("messageTarget");
  if (!select) return;

  if (currentUser.role === "admin") {
    select.innerHTML = `<option value="all">All Users</option>`;
    usersCache
      .filter((u) => u.role === "user")
      .forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = u.displayName;
        select.appendChild(opt);
      });
  } else {
    select.innerHTML = `<option value="admin">Administrator</option>`;
  }
}

/* ============================================================
   RENDER MESSAGES LIST
   ============================================================ */

function renderMessagesList() {
  const container = document.getElementById("messagesList");
  if (!container) return;

  container.innerHTML = "";

  let list = [];

  if (currentUser.role === "admin") {
    list = messagesCache;
  } else {
    list = messagesCache.filter(
      (m) =>
        m.fromUsername === currentUser.username ||
        m.toUsername === currentUser.username ||
        m.toUsername === "admin"
    );
  }

  list.sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  list.forEach((m) => {
    const card = document.createElement("div");
    card.className = "message-card";

    card.innerHTML = `
      <div class="message-header">
        <strong>From:</strong> ${m.fromDisplayName}  
        <br>
        <strong>To:</strong> ${m.toDisplayName}
      </div>

      <div class="message-body">${m.text}</div>

      <div class="message-footer">
        <strong>Sent at:</strong> ${m.createdAt}
      </div>
    `;

    container.appendChild(card);
  });
}

/* --- MAIN.JS — PART 4 END --- */

/* --- MAIN.JS — PART 5 START --- */

/* ============================================================
   MEMBERS — LIST, FREEZE, UPDATE
   ============================================================ */

function initMembers() {
  if (currentUser.role !== "admin") return;

  renderMembersList();
}

function renderMembersList() {
  const container = document.getElementById("membersList");
  if (!container) return;

  container.innerHTML = "";

  usersCache
    .sort((a, b) => a.username.localeCompare(b.username))
    .forEach((u) => {
      const card = document.createElement("div");
      card.className = "member-card";

      const frozenLabel = u.frozen
        ? `<span class="frozen-label">(Frozen)</span>`
        : "";

      card.innerHTML = `
        <div class="member-header">
          <strong>${u.displayName}</strong> ${frozenLabel}
        </div>

        <div><strong>Username:</strong> ${u.username}</div>
        <div><strong>Role:</strong> ${u.role}</div>
        <div><strong>Phone:</strong> ${u.phone || "-"}</div>

        <button class="freeze-btn" onclick="toggleFreeze('${u.username}', ${u.frozen})">
          ${u.frozen ? "Unfreeze" : "Freeze"}
        </button>
      `;

      container.appendChild(card);
    });
}

/* -----------------------------
   Freeze / Unfreeze User
------------------------------ */

async function toggleFreeze(username, isFrozen) {
  const user = usersCache.find((u) => u.username === username);
  if (!user) return;

  await update(ref(db, "users/" + username), {
    frozen: !isFrozen
  });

  showToast(isFrozen ? "User unfrozen." : "User frozen.");
}

/* ============================================================
   SETTINGS — CHANGE PASSWORD, UPDATE PHONE
   ============================================================ */

function initSettings() {
  const form = document.getElementById("settingsForm");
  const errorEl = document.getElementById("settingsError");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const phone = document.getElementById("settingsPhone").value.trim();
    const oldPass = document.getElementById("settingsOldPass").value.trim();
    const newPass = document.getElementById("settingsNewPass").value.trim();

    const user = usersCache.find((u) => u.username === currentUser.username);
    if (!user) {
      showMessage(errorEl, "User not found.");
      return;
    }

    if (oldPass || newPass) {
      if (!oldPass || !newPass) {
        showMessage(errorEl, "Enter old and new password.");
        return;
      }

      const oldHash = await hashPassword(oldPass);
      if (oldHash !== user.passwordHash) {
        showMessage(errorEl, "Old password incorrect.");
        return;
      }

      const newHash = await hashPassword(newPass);

      await update(ref(db, "users/" + user.username), {
        passwordHash: newHash,
        phone,
        forceChangePassword: false
      });

      currentUser.forceChangePassword = false;
      saveSessionLocal(currentUser);

      showToast("Password updated.");
    } else {
      await update(ref(db, "users/" + user.username), {
        phone
      });

      showToast("Phone updated.");
    }

    disableTabsExceptSettings(false);
  });
}

/* ============================================================
   STATISTICS
   ============================================================ */

function initStatistics() {
  if (currentUser.role !== "admin") return;
  updateStatsSummary();
}

function updateStatsSummary() {
  const totalMov = document.getElementById("statsTotalMovements");
  const totalUsers = document.getElementById("statsTotalUsers");

  if (!totalMov || !totalUsers) return;

  totalMov.textContent = movementsCache.length;
  totalUsers.textContent = usersCache.length;
}

/* ============================================================
   GLOBAL SEARCH
   ============================================================ */

function initGlobalSearch() {
  const input = document.getElementById("globalSearchInput");
  const container = document.getElementById("globalSearchResults");

  if (!input || !container) return;

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    container.innerHTML = "";

    if (!q) return;

    const results = [];

    movementsCache.forEach((m) => {
      if (
        m.driver.toLowerCase().includes(q) ||
        m.plate.toLowerCase().includes(q) ||
        m.destination.toLowerCase().includes(q) ||
        m.notes.toLowerCase().includes(q)
      ) {
        results.push({
          type: "Movement",
          text: `${m.driver} — ${m.plate} — ${m.destination}`,
          createdAt: m.createdAt
        });
      }
    });

    usersCache.forEach((u) => {
      if (
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q)
      ) {
        results.push({
          type: "User",
          text: `${u.displayName} (${u.username})`,
          createdAt: ""
        });
      }
    });

    results.forEach((r) => {
      const item = document.createElement("div");
      item.className = "search-item";
      item.innerHTML = `
        <strong>${r.type}:</strong> ${r.text}
        ${r.createdAt ? `<br><span>${r.createdAt}</span>` : ""}
      `;
      container.appendChild(item);
    });
  });
}

/* ============================================================
   LOGOUT
   ============================================================ */

function initLogout() {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    clearSessionLocal();
    location.reload();
  });
}

/* --- MAIN.JS — PART 5 END --- */
