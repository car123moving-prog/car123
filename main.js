// main.js — Car Movement System v2.0 (Final Corrected Version)
// نظام إدارة حركة السيارات - مجموعة المسعود

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  onValue,
  onChildAdded,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Firebase Configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate unique ID for users and movements
function generateUID(prefix, identifier) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}_${timestamp}_${random}_${identifier}`;
}

// Password hashing
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

// Get Gulf time (UTC+4)
function getGulfNow() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 4 * 60 * 60 * 1000);
}

// Format date and time
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

// Format English date and time for display
function formatEnglishDateTime() {
  const now = getGulfNow();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[now.getDay()];
  
  const dateStr = `${dayName} ${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  
  return `${dateStr} | ${timeStr}`;
}

// Check if within 24 hours
function isWithin24Hours(timestamp) {
  if (!timestamp) return false;
  const now = Date.now();
  const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
  return hoursDiff <= 24;
}

// Time difference in hours
function getTimeDiffHours(timestamp) {
  if (!timestamp) return 0;
  const now = Date.now();
  return (now - timestamp) / (1000 * 60 * 60);
}

// Screen management
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.toggle("active", s.id === id);
  });
}

// View management
function showView(id) {
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.toggle("active", v.id === id);
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === id);
  });
}

// Message display
function showMessage(el, msg, type = "error") {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("success-text", "error-text", "warning-text", "info-text");
  
  if (type === "success") el.classList.add("success-text");
  else if (type === "warning") el.classList.add("warning-text");
  else if (type === "info") el.classList.add("info-text");
  else el.classList.add("error-text");
  
  if (msg) {
    setTimeout(() => {
      el.textContent = "";
    }, 3000);
  }
}

// Toast notification
function showToast(message, type = "info") {
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
  
  if (type === "success") {
    toast.style.background = "#2e7d32";
  } else if (type === "warning") {
    toast.style.background = "#f0ad4e";
  } else if (type === "error") {
    toast.style.background = "#d9534f";
  } else {
    toast.style.background = "#0b3c6f";
  }
  
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

// ============================================
// GLOBAL STATE
// ============================================

let currentUser = null;
let requirePasswordChange = false;
let movementsCache = [];
let usersCache = [];
let messagesCache = [];

// ============================================
// FIREBASE DATA MANAGEMENT
// ============================================

// Ensure default users exist
async function ensureDefaultUsers() {
  const snap = await get(ref(db, "users"));
  if (!snap.exists()) {
    const adminHash = await hashPassword("1234");
    const userHash = await hashPassword("1234");
    
    const updates = {};
    
    // Create admin user with UID
    const adminUID = generateUID("user", "admin");
    updates[`users/${adminUID}`] = {
      uid: adminUID,
      username: "admin",
      passwordHash: adminHash,
      displayName: "Administrator",
      phone: "",
      role: "admin",
      isActive: true,
      forceChangePassword: true,
      createdAt: Date.now()
    };
    
    // Create regular user with UID
    const userUID = generateUID("user", "user1");
    updates[`users/${userUID}`] = {
      uid: userUID,
      username: "user1",
      passwordHash: userHash,
      displayName: "User One",
      phone: "",
      role: "user",
      isActive: true,
      forceChangePassword: false,
      createdAt: Date.now()
    };
    
    await update(ref(db), updates);
    showToast("Default users created successfully", "success");
  }
}

// Load all users
async function loadUsers() {
  const snap = await get(ref(db, "users"));
  usersCache = [];
  if (snap.exists()) {
    const val = snap.val();
    usersCache = Object.values(val);
  }
}

// Listen to movements in real-time
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

// Listen to messages in real-time
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
    
    if (msg.to === "all" || msg.to === currentUser.username) {
      showToast(`New message from ${msg.fromDisplayName || msg.fromUsername}`, "info");
    }
  });
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function saveSessionLocal(user) {
  const safe = {
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
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
  const badgesEl = document.getElementById("userBadges");
  const dateTimeEl = document.getElementById("currentDateTime");
  
  if (!currentUser) return;
  
  if (nameEl) nameEl.textContent = currentUser.displayName || currentUser.username;
  if (roleEl) roleEl.textContent = currentUser.role === "admin" ? "Administrator" : "User";
  
  if (badgesEl) {
    badgesEl.innerHTML = "";
    
    // Role badge
    const roleBadge = document.createElement("span");
    roleBadge.className = `user-badge ${currentUser.role}`;
    roleBadge.textContent = currentUser.role === "admin" ? "ADMIN" : "USER";
    badgesEl.appendChild(roleBadge);
    
    // Status badge if banned
    if (currentUser.isActive === false) {
      const statusBadge = document.createElement("span");
      statusBadge.className = "user-badge banned";
      statusBadge.textContent = "BANNED";
      badgesEl.appendChild(statusBadge);
    }
  }
  
  // Update date time display
  updateDateTime();
}

function updateDateTime() {
  const el = document.getElementById("currentDateTime");
  if (el) {
    el.textContent = formatEnglishDateTime();
  }
}

// ============================================
// PERMISSIONS & VISIBILITY CONTROL
// ============================================

function applyRoleVisibility() {
  const isAdmin = currentUser && currentUser.role === "admin";
  const isActive = currentUser && currentUser.isActive !== false;
  
  // Show/hide tabs based on role
  const membersTab = document.querySelector('.tab-btn[data-view="viewMembers"]');
  const statsTab = document.querySelector('.tab-btn[data-view="viewStatistics"]');
  
  if (membersTab) membersTab.style.display = isAdmin ? "" : "none";
  if (statsTab) statsTab.style.display = isAdmin ? "" : "none";
  
  // Show/hide add member card for admin
  const addMemberCard = document.getElementById("addMemberCard");
  if (addMemberCard) addMemberCard.style.display = isAdmin ? "" : "none";
  
  // Show/hide target user field in add movement form
  const targetUserRow = document.getElementById("targetUserRow");
  const targetUserLabel = document.querySelector('label[for="movementTargetUser"]');
  if (targetUserRow && targetUserLabel) {
    if (isAdmin) {
      targetUserRow.style.display = "";
      targetUserLabel.style.display = "";
    } else {
      targetUserRow.style.display = "none";
      targetUserLabel.style.display = "none";
    }
  }
  
  // Redirect if trying to access restricted views
  if (!isAdmin) {
    if (document.getElementById("viewMembers").classList.contains("active") ||
        document.getElementById("viewStatistics").classList.contains("active")) {
      showView("viewMovements");
      showToast("You don't have permission to access this section", "warning");
    }
  }
  
  // Disable everything if user is banned
  if (!isActive) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
      if (btn.dataset.view !== "viewSettings") {
        btn.disabled = true;
        btn.style.pointerEvents = "none";
        btn.style.opacity = "0.5";
      }
    });
    
    document.querySelectorAll("input, select, textarea, button").forEach(el => {
      if (!el.closest("#viewSettings")) {
        el.disabled = true;
      }
    });
    
    showToast("Your account has been suspended", "error");
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

// Check permissions for movement actions - CORRECTED VERSION
function canEditMovement(movement) {
  if (!currentUser) return false;
  if (currentUser.isActive === false) return false;
  
  // Admin can edit notes of any movement
  if (currentUser.role === "admin") {
    return { 
      canEdit: true, 
      canEditNotes: true,
      canEditSacredFields: false, // NO ONE can edit sacred fields
      reason: "Admin can edit notes only"
    };
  }
  
  // User can only edit their own movements' notes within 24 hours
  if (movement.createdBy === currentUser.username) {
    const canEditNotes = isWithin24Hours(movement.createdAt);
    return { 
      canEdit: canEditNotes, 
      canEditNotes: canEditNotes,
      canEditSacredFields: false,
      reason: canEditNotes ? "Owner within 24 hours" : "Time limit expired (24h)"
    };
  }
  
  return { 
    canEdit: false, 
    canEditNotes: false,
    canEditSacredFields: false,
    reason: "Not owner" 
  };
}

function canViewMovement(movement) {
  if (!currentUser) return false;
  if (currentUser.isActive === false) return false;
  
  // Admin can view all movements
  if (currentUser.role === "admin") return true;
  
  // User can view their own movements or movements assigned to them
  return movement.createdBy === currentUser.username || 
         movement.targetUser === currentUser.username;
}

// ============================================
// UI INITIALIZATION
// ============================================

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!currentUser) return;
      if (currentUser.isActive === false && btn.dataset.view !== "viewSettings") {
        showToast("Your account has been suspended", "error");
        return;
      }
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
      
      const isOpen = body.classList.contains("open");
      const parentCard = h.closest(".card");
      if (parentCard) {
        parentCard.querySelectorAll(".collapsible-body").forEach(b => {
          if (b !== body) b.classList.remove("open");
        });
        parentCard.querySelectorAll(".collapse-indicator").forEach(ind => {
          ind.textContent = "▼";
        });
      }
      
      if (isOpen) {
        body.classList.remove("open");
        h.querySelector(".collapse-indicator").textContent = "▼";
      } else {
        body.classList.add("open");
        h.querySelector(".collapse-indicator").textContent = "▲";
      }
    });
  });

  const addMovementBody = document.getElementById("addMovementBody");
  if (addMovementBody) addMovementBody.classList.add("open");
}

// ============================================
// LOGIN SYSTEM
// ============================================

async function handleLogin() {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");

  // Check for existing session
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

    // Find user by username
    const found = usersCache.find((u) => u.username === username);
    if (!found) {
      showMessage(loginError, "Invalid username or password.");
      return;
    }
    
    // Check if user is active
    if (found.isActive === false) {
      showMessage(loginError, "Your account has been suspended.");
      return;
    }
    
    // Verify password
    const hash = await hashPassword(password);
    if (found.passwordHash !== hash) {
      showMessage(loginError, "Invalid username or password.");
      return;
    }

    // Set current user
    currentUser = {
      uid: found.uid,
      username: found.username,
      displayName: found.displayName,
      role: found.role,
      isActive: found.isActive,
      forceChangePassword: !!found.forceChangePassword
    };
    
    saveSessionLocal(currentUser);

    // Check if password change is required
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
  
  // Update date time every minute
  setInterval(updateDateTime, 60000);

  // Force password change for admin if required
  if (currentUser && currentUser.role === "admin" && currentUser.forceChangePassword) {
    requirePasswordChange = true;
    showView("viewSettings");
    disableTabsExceptSettings(true);
    showToast("Please change your password in Settings.", "warning");
  } else {
    requirePasswordChange = false;
    disableTabsExceptSettings(false);
  }
}

function initLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;
  
  logoutBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to logout?")) {
      clearSessionLocal();
      currentUser = null;
      showScreen("screenLogin");
      showToast("Logged out successfully", "info");
    }
  });
}

// ============================================
// MOVEMENTS MANAGEMENT
// ============================================

function renderDriverSelect() {
  const select = document.getElementById("movementDriverSelect");
  if (!select) return;
  
  select.innerHTML = "";
  
  // Only show active users
  const activeUsers = usersCache.filter(u => u.isActive !== false);
  
  activeUsers.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = `${u.displayName} (${u.username})`;
    select.appendChild(opt);
  });
}

function renderTargetUserSelect() {
  const select = document.getElementById("movementTargetUser");
  if (!select) return;
  
  select.innerHTML = '<option value="">Self (Default)</option>';
  
  // Admin can assign to any active user except themselves
  if (currentUser && currentUser.role === "admin") {
    const activeUsers = usersCache.filter(u => 
      u.isActive !== false && u.username !== currentUser.username
    );
    
    activeUsers.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = `${u.displayName} (${u.username})`;
      select.appendChild(opt);
    });
  }
}

function buildMovementItem(m) {
  const div = document.createElement("div");
  div.className = "list-item";
  div.id = `movement-${m.id}`;
  
  // Check if user can view this movement
  if (!canViewMovement(m)) {
    div.style.display = "none";
    return div;
  }

  const header = document.createElement("div");
  header.className = "list-item-header";

  const left = document.createElement("div");
  const badge = document.createElement("span");
  badge.className = "badge " + m.type;
  badge.textContent = m.type === "receive" ? "RECEIVE" : "DELIVER";

  const title = document.createElement("span");
  title.style.marginLeft = "8px";
  title.style.fontWeight = "600";
  title.textContent = `Car ${m.carNumber} - Plate ${m.plate}`;

  left.appendChild(badge);
  left.appendChild(title);

  const right = document.createElement("div");
  right.className = "list-item-meta";
  right.textContent = m.date || "";

  header.appendChild(left);
  header.appendChild(right);

  // Movement metadata - Sacred Fields
  const meta = document.createElement("div");
  meta.className = "list-item-meta";
  
  let metaText = `Driver: ${m.driverName || m.driverUsername} | Created by: ${m.createdByDisplayName || m.createdBy}`;
  
  // Show target user if different from creator
  if (m.targetUser && m.targetUser !== m.createdBy) {
    const targetUser = usersCache.find(u => u.username === m.targetUser);
    metaText += ` | For: ${targetUser ? targetUser.displayName : m.targetUser}`;
  }
  
  meta.textContent = metaText;

  // Notes section
  const notes = document.createElement("div");
  notes.className = "message-text";
  notes.innerHTML = `<strong>Notes:</strong> ${m.notes || "-"}`;

  // Show modification history if exists
  if (m.lastModifiedBy || m.originalNotes) {
    const history = document.createElement("div");
    history.className = "notes-history";
    history.style.marginTop = "10px";
    history.style.padding = "10px";
    history.style.fontSize = "0.85em";
    history.style.backgroundColor = "#f8f9fa";
    history.style.borderRadius = "6px";
    
    let historyHTML = "";
    
    if (m.lastModifiedBy) {
      historyHTML += `<div><strong>Last modified by:</strong> ${m.lastModifiedBy}</div>`;
    }
    
    if (m.lastModifiedAt) {
      historyHTML += `<div><strong>Last modified at:</strong> ${m.lastModifiedAt}</div>`;
    }
    
    if (m.originalNotes && m.originalNotes !== m.notes) {
      historyHTML += `<div style="margin-top: 5px;"><strong>Original notes:</strong></div>`;
      historyHTML += `<div class="original-notes-text">${m.originalNotes}</div>`;
    }
    
    history.innerHTML = historyHTML;
    div.appendChild(history);
  }

  // Action buttons
  const actions = document.createElement("div");
  actions.className = "list-item-actions";

  // Edit button with permission check - ONLY for editing NOTES
  const editPermission = canEditMovement(m);
  if (editPermission.canEdit) {
    const btnEdit = document.createElement("button");
    btnEdit.className = "action-btn";
    btnEdit.textContent = "Edit Notes Only";
    btnEdit.addEventListener("click", () => openEditMovementModal(m));
    actions.appendChild(btnEdit);
    
    // Add time warning for regular users
    if (currentUser.role === "user" && m.createdBy === currentUser.username) {
      const hoursDiff = getTimeDiffHours(m.createdAt);
      if (hoursDiff > 20 && hoursDiff <= 24) {
        const warning = document.createElement("div");
        warning.className = "time-limit-warning";
        warning.textContent = `Time remaining: ${Math.round(24 - hoursDiff)} hours`;
        actions.appendChild(warning);
      }
    }
  }

  // Share button
  const btnShare = document.createElement("button");
  btnShare.className = "action-btn";
  btnShare.textContent = "Share";
  btnShare.addEventListener("click", () => shareMovement(m));
  actions.appendChild(btnShare);

  // Print button
  const btnPrint = document.createElement("button");
  btnPrint.className = "action-btn";
  btnPrint.textContent = "Print";
  btnPrint.addEventListener("click", () => printMovement(m));
  actions.appendChild(btnPrint);

  // Assemble the item
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
  
  // Filter movements based on user permissions
  let filteredMovements = movementsCache;
  if (currentUser && currentUser.role === "user") {
    filteredMovements = movementsCache.filter(m => 
      m.createdBy === currentUser.username || m.targetUser === currentUser.username
    );
  }
  
  // Sort by date (newest first)
  filteredMovements
    .slice()
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .reverse()
    .forEach((m) => {
      const item = buildMovementItem(m);
      if (item.style.display !== "none") {
        container.appendChild(item);
      }
    });
  
  // Show message if no movements visible
  if (container.children.length === 0) {
    container.innerHTML = `<div class="info-text">No movements found for your account.</div>`;
  }
}

function initMovements() {
  renderDriverSelect();
  renderTargetUserSelect();
  
  const form = document.getElementById("addMovementForm");
  const errorBox = document.getElementById("addMovementError");
  const successBox = document.getElementById("addMovementSuccess");
  
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (!currentUser) return;
    if (currentUser.isActive === false) {
      showMessage(errorBox, "Your account has been suspended.", "error");
      return;
    }
    
    if (requirePasswordChange) {
      showMessage(errorBox, "You must change your password first (Settings).");
      return;
    }

    const type = document.getElementById("movementType").value;
    const carNumber = document.getElementById("movementCarNumber").value.trim();
    const plate = document.getElementById("movementPlate").value.trim();
    const driverUsername = document.getElementById("movementDriverSelect").value;
    const targetUser = document.getElementById("movementTargetUser").value;
    const notes = document.getElementById("movementNotes").value.trim();

    // Validation
    if (!carNumber || !plate || !driverUsername) {
      showMessage(errorBox, "Please fill required fields.");
      return;
    }

    // Permission check: User can only add for themselves
    if (currentUser.role === "user" && targetUser && targetUser !== currentUser.username) {
      showMessage(errorBox, "You can only add movements for yourself.");
      return;
    }

    const driver = usersCache.find((u) => u.username === driverUsername);
    const now = getGulfNow();
    
    // Create movement object
    const movement = {
      type,
      carNumber,
      plate,
      driverUsername,
      driverName: driver ? driver.displayName : driverUsername,
      notes,
      originalNotes: notes,
      createdBy: currentUser.username,
      createdByDisplayName: currentUser.displayName,
      targetUser: targetUser || currentUser.username,
      date: formatDateTime(now),
      createdAt: Date.now(),
      lastModifiedBy: null,
      lastModifiedAt: null,
      notesHistory: []
    };

    try {
      const newRef = push(ref(db, "movements"));
      await set(newRef, movement);
      
      form.reset();
      showMessage(successBox, "Movement saved successfully.", "success");
      showToast("Movement added successfully", "success");
      
      // Reset target user select
      renderTargetUserSelect();
      
    } catch (error) {
      showMessage(errorBox, "Error saving movement: " + error.message);
      console.error("Error saving movement:", error);
    }
  });

  initEditMovementModal();
}

function openEditMovementModal(m) {
  const modal = document.getElementById("editMovementModal");
  if (!modal) return;
  
  // Check permissions
  const permission = canEditMovement(m);
  if (!permission.canEdit) {
    showToast(`Cannot edit: ${permission.reason}`, "warning");
    return;
  }

  // Populate form - ALL fields are read-only except notes
  document.getElementById("editMovementId").value = m.id;
  document.getElementById("editMovementType").value = m.type.toUpperCase();
  document.getElementById("editMovementCarNumber").value = m.carNumber;
  document.getElementById("editMovementPlate").value = m.plate;
  document.getElementById("editMovementDriverDisplay").value = m.driverName || m.driverUsername;
  document.getElementById("editMovementNotes").value = m.notes || "";
  
  // Show notes history if available
  const historySection = document.getElementById("editMovementHistory");
  if (m.originalNotes || m.lastModifiedBy) {
    historySection.style.display = "block";
    
    if (m.originalNotes) {
      document.getElementById("originalNotesText").textContent = m.originalNotes || m.notes;
    }
    
    if (m.lastModifiedBy) {
      document.getElementById("lastModifiedByText").textContent = m.lastModifiedBy;
    }
    
    if (m.lastModifiedAt) {
      document.getElementById("lastModifiedAtText").textContent = m.lastModifiedAt;
    }
  } else {
    historySection.style.display = "none";
  }
  
  // Show modal
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
    form.reset();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (!currentUser || currentUser.isActive === false) return;

    const id = document.getElementById("editMovementId").value;
    const notes = document.getElementById("editMovementNotes").value.trim();

    // Basic validation
    if (notes === "") {
      showMessage(errorBox, "Notes cannot be empty.");
      return;
    }

    // Find existing movement
    const existing = movementsCache.find((m) => m.id === id);
    if (!existing) {
      showMessage(errorBox, "Movement not found.");
      return;
    }

    // Check permissions again
    const permission = canEditMovement(existing);
    if (!permission.canEdit) {
      showMessage(errorBox, `Cannot edit: ${permission.reason}`);
      return;
    }

    // Check time limit for regular users
    if (currentUser.role === "user" && existing.createdBy === currentUser.username) {
      if (!isWithin24Hours(existing.createdAt)) {
        showMessage(errorBox, "Cannot edit: Time limit expired (24h).");
        return;
      }
    }

    const now = getGulfNow();
    
    // Prepare update - ONLY notes can be changed
    const updated = {
      ...existing,
      notes: notes, // Only notes field changes
      lastModifiedBy: currentUser.displayName || currentUser.username,
      lastModifiedAt: formatDateTime(now)
    };
    
    // Save original notes if this is the first edit
    if (!existing.originalNotes) {
      updated.originalNotes = existing.notes;
    }
    
    // Add to notes history
    if (!updated.notesHistory) updated.notesHistory = [];
    updated.notesHistory.push({
      notes: notes,
      modifiedBy: currentUser.displayName || currentUser.username,
      modifiedAt: formatDateTime(now),
      timestamp: Date.now()
    });

    try {
      await set(ref(db, `movements/${id}`), updated);
      showMessage(successBox, "Movement notes updated successfully.", "success");
      showToast("Movement notes updated", "success");
      
      setTimeout(() => {
        modal.classList.remove("active");
        form.reset();
      }, 800);
      
    } catch (error) {
      showMessage(errorBox, "Error updating movement notes: " + error.message);
      console.error("Error updating movement:", error);
    }
  });
}

function shareMovement(m) {
  let text = `Movement Details:\n`;
  text += `Type: ${m.type.toUpperCase()}\n`;
  text += `Car Number: ${m.carNumber}\n`;
  text += `Plate: ${m.plate}\n`;
  text += `Driver: ${m.driverName || m.driverUsername}\n`;
  text += `Created by: ${m.createdByDisplayName || m.createdBy}\n`;
  
  if (m.targetUser && m.targetUser !== m.createdBy) {
    const targetUser = usersCache.find(u => u.username === m.targetUser);
    text += `For: ${targetUser ? targetUser.displayName : m.targetUser}\n`;
  }
  
  text += `Date: ${m.date}\n`;
  text += `Notes: ${m.notes || "-"}\n`;

  if (navigator.share) {
    navigator.share({
      title: 'Car Movement',
      text: text,
      url: window.location.href
    }).catch(() => {
      // Fallback to clipboard
      navigator.clipboard.writeText(text).then(() => {
        showToast("Details copied to clipboard", "info");
      });
    });
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Details copied to clipboard", "info");
    });
  }
}

function printMovement(m) {
  const text = `Movement Record\n` +
    `================\n` +
    `Type: ${m.type.toUpperCase()}\n` +
    `Car Number: ${m.carNumber}\n` +
    `Plate: ${m.plate}\n` +
    `Driver: ${m.driverName || m.driverUsername}\n` +
    `Created by: ${m.createdByDisplayName || m.createdBy}\n` +
    `Date: ${m.date}\n` +
    `Notes: ${m.notes || "-"}\n` +
    `\n` +
    `Al Masaood Group\n` +
    `Car Movement System`;
  
  const w = window.open("", "_blank");
  if (!w) {
    showToast("Please allow popups to print", "warning");
    return;
  }
  
  w.document.write(`
    <html>
      <head>
        <title>Movement Print</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          pre { background: #f5f5f5; padding: 15px; border-radius: 5px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <pre>${text}</pre>
        <div class="no-print">
          <button onclick="window.print()">Print</button>
          <button onclick="window.close()">Close</button>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 1000);
          }
        </script>
      </body>
    </html>
  `);
  w.document.close();
}

// ============================================
// MEMBERS MANAGEMENT
// ============================================

function renderMessageTargets() {
  const select = document.getElementById("messageTarget");
  const statsUserSelect = document.getElementById("statsUserSelect");
  
  if (select) {
    select.innerHTML = "";
    
    // Admin can send to "All" or specific users
    if (currentUser && currentUser.role === "admin") {
      const optAll = document.createElement("option");
      optAll.value = "all";
      optAll.textContent = "All Members";
      optAll.className = "message-target-all";
      select.appendChild(optAll);
    }
    
    // Regular users can only send to admin
    const activeUsers = usersCache.filter(u => u.isActive !== false);
    
    if (currentUser && currentUser.role === "user") {
      // User can only send to admin
      const admin = activeUsers.find(u => u.role === "admin");
      if (admin) {
        const opt = document.createElement("option");
        opt.value = admin.username;
        opt.textContent = `${admin.displayName} (Admin)`;
        select.appendChild(opt);
      }
    } else if (currentUser && currentUser.role === "admin") {
      // Admin can send to any active user
      activeUsers.forEach((u) => {
        if (u.username !== currentUser.username) {
          const opt = document.createElement("option");
          opt.value = u.username;
          opt.textContent = `${u.displayName} (${u.role === 'admin' ? 'Admin' : 'User'})`;
          select.appendChild(opt);
        }
      });
    }
  }
  
  if (statsUserSelect) {
    statsUserSelect.innerHTML = "";
    const activeUsers = usersCache.filter(u => u.isActive !== false);
    
    activeUsers.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = `${u.displayName} (${u.username})`;
      statsUserSelect.appendChild(opt);
    });
  }
}

function openMemberEditModal(user) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content card" style="max-width: 500px;">
      <div class="modal-header">
        <h3>Edit Member: ${user.displayName}</h3>
        <button class="text-btn close-modal">Close</button>
      </div>
      <form class="form-grid" id="memberEditForm">
        <input type="hidden" id="editMemberUsername" value="${user.username}">
        <div class="form-row">
          <label>Display Name</label>
          <input type="text" id="editMemberDisplayName" value="${user.displayName}" required>
        </div>
        <div class="form-row">
          <label>Phone</label>
          <input type="text" id="editMemberPhone" value="${user.phone || ''}">
        </div>
        ${currentUser.role === 'admin' ? `
          <div class="form-row">
            <label>Role</label>
            <select id="editMemberRole">
              <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </div>
          <div class="form-row">
            <label>Status</label>
            <select id="editMemberStatus">
              <option value="active" ${user.isActive !== false ? 'selected' : ''}>Active</option>
              <option value="banned" ${user.isActive === false ? 'selected' : ''}>Banned</option>
            </select>
          </div>
        ` : ''}
        <button type="submit" class="btn-primary">Save Changes</button>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event listeners
  modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if(e.target === modal) modal.remove(); });
  
  modal.querySelector('#memberEditForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('editMemberUsername').value;
    const userObj = usersCache.find(u => u.username === username);
    
    if (!userObj) {
      showToast('User not found', 'error');
      return;
    }
    
    const userData = {
      displayName: document.getElementById('editMemberDisplayName').value.trim(),
      phone: document.getElementById('editMemberPhone').value.trim()
    };
    
    if(currentUser.role === 'admin') {
      userData.role = document.getElementById('editMemberRole').value;
      userData.isActive = document.getElementById('editMemberStatus').value === 'active';
    }
    
    try {
      await set(ref(db, `users/${userObj.uid}`), { ...userObj, ...userData });
      showToast('Member updated successfully', 'success');
      modal.remove();
      await loadUsers();
      renderMembersList();
      renderDriverSelect();
      renderMessageTargets();
    } catch(error) {
      showToast('Error updating member', 'error');
    }
  });
}

function buildMemberAccordionItem(user) {
  const div = document.createElement("div");
  div.className = "member-accordion-item";
  div.id = `member-${user.username}`;
  
  // Header (clickable)
  const header = document.createElement("div");
  header.className = "member-accordion-header";
  
  const infoDiv = document.createElement("div");
  infoDiv.className = "member-info";
  
  const nameSpan = document.createElement("div");
  nameSpan.className = "member-name";
  nameSpan.textContent = user.displayName;
  
  const userSpan = document.createElement("div");
  userSpan.className = "member-username";
  userSpan.textContent = `@${user.username}`;
  
  infoDiv.appendChild(nameSpan);
  infoDiv.appendChild(userSpan);
  
  const detailsDiv = document.createElement("div");
  detailsDiv.className = "member-details";
  
  // Role badge
  const roleBadge = document.createElement("span");
  roleBadge.className = `member-role-badge ${user.role}`;
  roleBadge.textContent = user.role === 'admin' ? 'Admin' : 'User';
  detailsDiv.appendChild(roleBadge);
  
  // Status badge
  const statusBadge = document.createElement("span");
  statusBadge.className = `member-status-badge ${user.isActive === false ? 'banned' : 'active'}`;
  statusBadge.textContent = user.isActive === false ? 'Banned' : 'Active';
  detailsDiv.appendChild(statusBadge);
  
  // Collapse icon
  const icon = document.createElement("span");
  icon.className = "member-accordion-icon";
  icon.textContent = "▼";
  
  header.appendChild(infoDiv);
  header.appendChild(detailsDiv);
  header.appendChild(icon);
  
  // Body (collapsible)
  const body = document.createElement("div");
  body.className = "member-accordion-body";
  
  // Member details
  const detailsHTML = `
    <div class="member-details-grid">
      <div class="member-detail-item">
        <div class="member-detail-label">Phone</div>
        <div class="member-detail-value">${user.phone || '-'}</div>
      </div>
      <div class="member-detail-item">
        <div class="member-detail-label">Role</div>
        <div class="member-detail-value">${user.role === 'admin' ? 'Administrator' : 'User'}</div>
      </div>
      <div class="member-detail-item">
        <div class="member-detail-label">Status</div>
        <div class="member-detail-value">${user.isActive === false ? 'Banned' : 'Active'}</div>
      </div>
      <div class="member-detail-item">
        <div class="member-detail-label">Account Created</div>
        <div class="member-detail-value">${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</div>
      </div>
    </div>
  `;
  
  body.innerHTML = detailsHTML;
  
  // Movements section
  const movementsSection = document.createElement("div");
  movementsSection.className = "member-movements-section";
  
  const movementsTitle = document.createElement("div");
  movementsTitle.className = "member-movements-title";
  movementsTitle.innerHTML = `<span>Recent Movements</span>`;
  
  const movementsList = document.createElement("div");
  movementsList.className = "member-movements-list";
  movementsList.id = `movements-${user.username}`;
  movementsList.innerHTML = `<div class="info-text">Loading movements...</div>`;
  
  movementsSection.appendChild(movementsTitle);
  movementsSection.appendChild(movementsList);
  body.appendChild(movementsSection);
  
  // Control buttons
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "member-controls";
  
  // Edit button - available for admin or self
  if(currentUser && (currentUser.role === 'admin' || currentUser.username === user.username)) {
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openMemberEditModal(user));
    controlsDiv.appendChild(editBtn);
  }
  
  // Ban/Activate button - admin only
  if(currentUser && currentUser.role === 'admin' && user.username !== currentUser.username) {
    const banBtn = document.createElement('button');
    banBtn.className = `action-btn ${user.isActive === false ? 'bg-success' : 'bg-danger'}`;
    banBtn.textContent = user.isActive === false ? 'Activate' : 'Ban';
    banBtn.addEventListener('click', async () => {
      if(confirm(`Are you sure you want to ${user.isActive === false ? 'activate' : 'ban'} ${user.displayName}?`)) {
        try {
          await update(ref(db, `users/${user.uid}`), { 
            isActive: user.isActive === false ? true : false 
          });
          showToast(`Member ${user.isActive === false ? 'activated' : 'banned'}`, 'success');
          await loadUsers();
          renderMembersList();
          renderDriverSelect();
          renderMessageTargets();
        } catch(error) {
          showToast('Error updating member status', 'error');
        }
      }
    });
    controlsDiv.appendChild(banBtn);
  }
  
  if(controlsDiv.children.length > 0) {
    body.appendChild(controlsDiv);
  }
  
  // Toggle functionality
  header.addEventListener("click", () => {
    const isOpen = body.classList.contains("open");
    
    // Close all other accordions
    document.querySelectorAll('.member-accordion-body').forEach(b => {
      if (b !== body) b.classList.remove('open');
    });
    document.querySelectorAll('.member-accordion-header').forEach(h => {
      if (h !== header) h.classList.remove('active');
    });
    
    // Toggle current
    if (isOpen) {
      body.classList.remove("open");
      header.classList.remove("active");
    } else {
      body.classList.add("open");
      header.classList.add("active");
      
      // Load movements when opened
      loadMemberMovements(user.username, movementsList);
    }
  });
  
  div.appendChild(header);
  div.appendChild(body);
  
  return div;
}

function loadMemberMovements(username, container) {
  // Filter movements for this user
  const userMovements = movementsCache
    .filter(m => m.createdBy === username || m.targetUser === username)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5); // Last 5 movements
  
  if (userMovements.length === 0) {
    container.innerHTML = `<div class="info-text">No movements found.</div>`;
    return;
  }
  
  container.innerHTML = userMovements.map(m => `
    <div class="member-movement-item">
      <div>
        <span class="movement-type-badge ${m.type}">${m.type.toUpperCase()}</span>
        <strong>Car ${m.carNumber}</strong> (${m.plate})
      </div>
      <div style="font-size: 0.9em; color: #666; margin-top: 4px;">
        ${m.date} - ${m.notes ? m.notes.substring(0, 50) + (m.notes.length > 50 ? '...' : '') : 'No notes'}
      </div>
    </div>
  `).join("");
}

function renderMembersList() {
  const container = document.getElementById("membersList");
  if (!container) return;
  
  if (!usersCache || usersCache.length === 0) {
    container.innerHTML = `<div class="info-text">No members found.</div>`;
    return;
  }
  
  container.innerHTML = "";
  
  // Filter users based on permissions
  let filteredUsers = usersCache;
  if (currentUser && currentUser.role === "user") {
    // Regular users can only see themselves
    filteredUsers = usersCache.filter(u => u.username === currentUser.username);
  }
  
  // Sort: admins first, then active users, then banned
  filteredUsers.sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    if (a.isActive === false && b.isActive !== false) return 1;
    if (a.isActive !== false && b.isActive === false) return -1;
    return (a.displayName || a.username).localeCompare(b.displayName || b.username);
  });
  
  filteredUsers.forEach((user) => {
    container.appendChild(buildMemberAccordionItem(user));
  });
}

function initMembers() {
  const form = document.getElementById("addMemberForm");
  const errorBox = document.getElementById("addMemberError");
  const successBox = document.getElementById("addMemberSuccess");
  
  if (!form) return;

  // Initial render
  renderMembersList();
  renderDriverSelect();
  renderMessageTargets();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Only admin can add members
    if (!currentUser || currentUser.role !== "admin") {
      showMessage(errorBox, "Only administrators can add members.");
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
    const status = document.getElementById("memberStatus").value;

    // Validation
    if (!username || !password || !displayName) {
      showMessage(errorBox, "Please fill required fields.");
      return;
    }
    
    if (username.length < 3) {
      showMessage(errorBox, "Username must be at least 3 characters.");
      return;
    }
    
    if (password.length < 4) {
      showMessage(errorBox, "Password must be at least 4 characters.");
      return;
    }

    // Check if username already exists
    if (usersCache.find((u) => u.username === username)) {
      showMessage(errorBox, "Username already exists.");
      return;
    }

    const passwordHash = await hashPassword(password);
    const userUID = generateUID("user", username);
    
    const userObj = {
      uid: userUID,
      username,
      passwordHash,
      displayName,
      phone,
      role,
      isActive: status === "active",
      forceChangePassword: role === "admin",
      createdAt: Date.now()
    };

    try {
      await set(ref(db, `users/${userUID}`), userObj);
      
      // Refresh data
      await loadUsers();
      renderMembersList();
      renderDriverSelect();
      renderMessageTargets();
      
      form.reset();
      showMessage(successBox, "Member added successfully.", "success");
      showToast("New member added", "success");
      
    } catch (error) {
      showMessage(errorBox, "Error adding member: " + error.message);
      console.error("Error adding member:", error);
    }
  });
}

// ============================================
// MESSAGES MANAGEMENT
// ============================================

function renderMessagesList() {
  const container = document.getElementById("messagesList");
  if (!container) return;
  
  if (!messagesCache || messagesCache.length === 0) {
    container.innerHTML = `<div class="info-text">No messages yet.</div>`;
    return;
  }
  
  container.innerHTML = "";
  
  // Filter messages based on permissions
  let filteredMessages = messagesCache;
  
  if (currentUser && currentUser.role === "user") {
    // Users can see messages they sent or received (including "all" messages)
    filteredMessages = messagesCache.filter(msg => 
      msg.fromUsername === currentUser.username || 
      msg.to === currentUser.username ||
      msg.to === "all"
    );
  }
  
  // Sort by date (newest first)
  filteredMessages
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .reverse()
    .forEach((msg) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.id = `message-${msg.id}`;
      
      const fromDiv = document.createElement("div");
      fromDiv.className = "message-from";
      fromDiv.textContent = `From: ${msg.fromDisplayName || msg.fromUsername}`;
      
      const textDiv = document.createElement("div");
      textDiv.className = "message-text";
      textDiv.textContent = msg.text;
      
      const metaDiv = document.createElement("div");
      metaDiv.className = "message-meta";
      
      let metaText = `${msg.date} | To: `;
      if (msg.to === "all") {
        metaText += "All Members";
      } else {
        const recipient = usersCache.find(u => u.username === msg.to);
        metaText += recipient ? recipient.displayName : msg.to;
      }
      
      metaDiv.textContent = metaText;
      
      div.appendChild(fromDiv);
      div.appendChild(textDiv);
      div.appendChild(metaDiv);
      
      container.appendChild(div);
    });
  
  // Show message if no messages visible
  if (container.children.length === 0) {
    container.innerHTML = `<div class="info-text">No messages found for your account.</div>`;
  }
}

function initMessages() {
  const form = document.getElementById("sendMessageForm");
  const errorBox = document.getElementById("sendMessageError");
  const successBox = document.getElementById("sendMessageSuccess");
  const textArea = document.getElementById("messageText");
  
  if (!form) return;

  // Initial render
  renderMessageTargets();
  renderMessagesList();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    if (!currentUser) return;
    if (currentUser.isActive === false) {
      showMessage(errorBox, "Your account has been suspended.", "error");
      return;
    }
    
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
    
    if (!target) {
      showMessage(errorBox, "Please select a recipient.");
      return;
    }

    // Permission checks
    if (currentUser.role === "user") {
      // Users can only send to admin
      const admin = usersCache.find(u => u.role === "admin");
      if (!admin || target !== admin.username) {
        showMessage(errorBox, "You can only send messages to the administrator.");
        return;
      }
    }

    let toLabel = "All Members";
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

    try {
      const newRef = push(ref(db, "messages"));
      await set(newRef, message);
      
      form.reset();
      showMessage(successBox, "Message sent successfully.", "success");
      showToast("Message sent", "success");
      
    } catch (error) {
      showMessage(errorBox, "Error sending message: " + error.message);
      console.error("Error sending message:", error);
    }
  });
}

// ============================================
// STATISTICS
// ============================================

function updateStatsSummary() {
  const box = document.getElementById("statsSummaryBox");
  if (!box) return;
  
  // Only show stats to admin
  if (!currentUser || currentUser.role !== "admin") {
    box.innerHTML = `
      <div class="stats-restricted">
        <div class="stats-restricted-icon">📊</div>
        <div class="stats-restricted-text">Statistics are only available to administrators.</div>
      </div>
    `;
    return;
  }
  
  const total = movementsCache.length;
  const received = movementsCache.filter((m) => m.type === "receive").length;
  const delivered = movementsCache.filter((m) => m.type === "deliver").length;
  
  const activeUsers = usersCache.filter(u => u.isActive !== false).length;
  const bannedUsers = usersCache.filter(u => u.isActive === false).length;
  const totalMessages = messagesCache.length;
  
  box.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
      <div class="card" style="text-align: center; padding: 15px;">
        <div style="font-size: 2em; font-weight: bold; color: #0b3c6f;">${total}</div>
        <div style="font-size: 0.9em; color: #666;">Total Movements</div>
      </div>
      <div class="card" style="text-align: center; padding: 15px;">
        <div style="font-size: 2em; font-weight: bold; color: #0b8a5f;">${received}</div>
        <div style="font-size: 0.9em; color: #666;">Received</div>
      </div>
      <div class="card" style="text-align: center; padding: 15px;">
        <div style="font-size: 2em; font-weight: bold; color: #0b3c6f;">${delivered}</div>
        <div style="font-size: 0.9em; color: #666;">Delivered</div>
      </div>
      <div class="card" style="text-align: center; padding: 15px;">
        <div style="font-size: 2em; font-weight: bold; color: #2e7d32;">${activeUsers}</div>
        <div style="font-size: 0.9em; color: #666;">Active Users</div>
      </div>
    </div>
  `;
}

function initStatistics() {
  updateStatsSummary();

  const formRange = document.getElementById("statsRangeForm");
  const rangeResult = document.getElementById("statsRangeResult");
  
  if (formRange) {
    formRange.addEventListener("submit", (e) => {
      e.preventDefault();
      
      if (!currentUser || currentUser.role !== "admin") {
        rangeResult.textContent = "Access restricted to administrators.";
        return;
      }
      
      const fromDate = document.getElementById("statsFromDate").value;
      const toDate = document.getElementById("statsToDate").value;
      
      if (!fromDate || !toDate) {
        rangeResult.textContent = "Please select both dates.";
        return;
      }
      
      const fromTime = new Date(fromDate + "T00:00:00").getTime();
      const toTime = new Date(toDate + "T23:59:59").getTime();
      
      const filtered = movementsCache.filter((m) => {
        if (!m.date) return false;
        const movementDate = new Date(m.date.replace(" ", "T")).getTime();
        return movementDate >= fromTime && movementDate <= toTime;
      });
      
      const received = filtered.filter(m => m.type === "receive").length;
      const delivered = filtered.filter(m => m.type === "deliver").length;
      
      rangeResult.innerHTML = `
        <div style="margin-top: 10px;">
          <strong>Results for ${fromDate} to ${toDate}:</strong>
          <div style="margin-top: 5px;">Total Movements: ${filtered.length}</div>
          <div>Received: ${received}</div>
          <div>Delivered: ${delivered}</div>
        </div>
      `;
    });
  }

  const formUser = document.getElementById("statsUserForm");
  const userResult = document.getElementById("statsUserResult");
  
  if (formUser) {
    formUser.addEventListener("submit", (e) => {
      e.preventDefault();
      
      if (!currentUser || currentUser.role !== "admin") {
        userResult.textContent = "Access restricted to administrators.";
        return;
      }
      
      const selected = document.getElementById("statsUserSelect").value;
      if (!selected) {
        userResult.textContent = "Please select a user.";
        return;
      }
      
      const userMovements = movementsCache.filter(
        (m) => m.createdBy === selected || m.targetUser === selected
      );
      
      const created = movementsCache.filter(m => m.createdBy === selected).length;
      const assigned = movementsCache.filter(m => m.targetUser === selected && m.createdBy !== selected).length;
      
      userResult.innerHTML = `
        <div style="margin-top: 10px;">
          <strong>Statistics for ${selected}:</strong>
          <div style="margin-top: 5px;">Total Related Movements: ${userMovements.length}</div>
          <div>Created by user: ${created}</div>
          <div>Assigned to user: ${assigned}</div>
        </div>
      `;
    });
  }

  const formCar = document.getElementById("statsCarForm");
  const carResult = document.getElementById("statsCarResult");
  
  if (formCar) {
    formCar.addEventListener("submit", (e) => {
      e.preventDefault();
      
      if (!currentUser || currentUser.role !== "admin") {
        carResult.textContent = "Access restricted to administrators.";
        return;
      }
      
      const carNumber = document.getElementById("statsCarNumber").value.trim();
      if (!carNumber) {
        carResult.textContent = "Please enter car number.";
        return;
      }
      
      const filtered = movementsCache.filter(
        (m) => (m.carNumber || "").toLowerCase().includes(carNumber.toLowerCase())
      );
      
      const received = filtered.filter(m => m.type === "receive").length;
      const delivered = filtered.filter(m => m.type === "deliver").length;
      
      carResult.innerHTML = `
        <div style="margin-top: 10px;">
          <strong>Results for car number containing "${carNumber}":</strong>
          <div style="margin-top: 5px;">Total Movements: ${filtered.length}</div>
          <div>Received: ${received}</div>
          <div>Delivered: ${delivered}</div>
        </div>
      `;
    });
  }
}

// ============================================
// SETTINGS
// ============================================

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
      
      if (newPassword.length < 4) {
        showMessage(passError, "New password must be at least 4 characters.");
        return;
      }

      await loadUsers();
      const userIdx = usersCache.findIndex((u) => u.username === currentUser.username);
      
      if (userIdx === -1) {
        showMessage(passError, "User not found.");
        return;
      }

      const oldHash = await hashPassword(oldPassword);
      if (usersCache[userIdx].passwordHash !== oldHash) {
        showMessage(passError, "Current password is incorrect.");
        return;
      }

      const newHash = await hashPassword(newPassword);
      const updatedUser = {
        ...usersCache[userIdx],
        passwordHash: newHash,
        forceChangePassword: false
      };

      try {
        await set(ref(db, `users/${usersCache[userIdx].uid}`), updatedUser);
        
        // Update session
        currentUser.forceChangePassword = false;
        saveSessionLocal(currentUser);
        requirePasswordChange = false;
        disableTabsExceptSettings(false);
        
        showMessage(passSuccess, "Password updated successfully.", "success");
        showToast("Password updated", "success");
        passForm.reset();
        
      } catch (error) {
        showMessage(passError, "Error updating password: " + error.message);
        console.error("Error updating password:", error);
      }
    });
  }

  if (phoneForm) {
    phoneForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentUser) return;
      
      const newPhone = document.getElementById("newPhone").value.trim();
      if (!newPhone) {
        showMessage(phoneError, "Please enter phone number.");
        return;
      }

      await loadUsers();
      const userIdx = usersCache.findIndex((u) => u.username === currentUser.username);
      
      if (userIdx === -1) {
        showMessage(phoneError, "User not found.");
        return;
      }

      const updatedUser = {
        ...usersCache[userIdx],
        phone: newPhone
      };

      try {
        await set(ref(db, `users/${usersCache[userIdx].uid}`), updatedUser);
        
        // Update session
        currentUser.phone = newPhone;
        saveSessionLocal(currentUser);
        
        showMessage(phoneSuccess, "Phone number updated successfully.", "success");
        showToast("Phone number updated", "success");
        phoneForm.reset();
        
      } catch (error) {
        showMessage(phoneError, "Error updating phone number: " + error.message);
        console.error("Error updating phone number:", error);
      }
    });
  }
}

// ============================================
// GLOBAL SEARCH
// ============================================

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

    // Search movements (with permission check)
    movementsCache.forEach((m) => {
      if (!canViewMovement(m)) return;
      
      const text = `${m.carNumber} ${m.plate} ${m.driverName} ${m.notes} ${m.type}`.toLowerCase();
      if (text.includes(term)) {
        results.push({
          type: "movement",
          id: m.id,
          label: `🚗 Movement: ${m.carNumber} / ${m.plate} / ${m.driverName}`,
          date: m.date
        });
      }
    });

    // Search users (with permission check)
    usersCache.forEach((u) => {
      // Regular users can only search themselves
      if (currentUser && currentUser.role === "user" && u.username !== currentUser.username) {
        return;
      }
      
      const text = `${u.username} ${u.displayName} ${u.phone} ${u.role}`.toLowerCase();
      if (text.includes(term)) {
        results.push({
          type: "member",
          id: u.username,
          label: `👤 Member: ${u.displayName} (${u.username})`,
          role: u.role
        });
      }
    });

    // Search messages (with permission check)
    messagesCache.forEach((msg) => {
      // Check if user can view this message
      if (currentUser && currentUser.role === "user") {
        if (msg.fromUsername !== currentUser.username && 
            msg.to !== currentUser.username && 
            msg.to !== "all") {
          return;
        }
      }
      
      const text = `${msg.text} ${msg.fromDisplayName} ${msg.toLabel}`.toLowerCase();
      if (text.includes(term)) {
        results.push({
          type: "message",
          id: msg.id,
          label: `📨 Message: ${msg.text.substring(0, 50)}...`,
          from: msg.fromDisplayName
        });
      }
    });

    // Display results
    if (results.length === 0) {
      box.innerHTML = `<div class="search-result-item">No results found.</div>`;
    } else {
      box.innerHTML = "";
      results.forEach((r) => {
        const div = document.createElement("div");
        div.className = "search-result-item";
        
        let badge = "";
        if (r.type === "movement") badge = "🚗 ";
        else if (r.type === "member") badge = "👤 ";
        else if (r.type === "message") badge = "📨 ";
        
        div.innerHTML = `
          <div style="font-weight: 600;">${badge}${r.label}</div>
          ${r.date ? `<div style="font-size: 0.85em; color: #666;">${r.date}</div>` : ''}
          ${r.role ? `<div style="font-size: 0.85em; color: #666;">${r.role}</div>` : ''}
          ${r.from ? `<div style="font-size: 0.85em; color: #666;">From: ${r.from}</div>` : ''}
        `;
        
        div.addEventListener("click", () => {
          overlay.classList.remove("active");
          
          if (r.type === "movement") {
            showView("viewMovements");
            setTimeout(() => {
              const el = document.getElementById(`movement-${r.id}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.style.animation = "pulse 2s";
                setTimeout(() => el.style.animation = "", 2000);
              }
            }, 100);
            
          } else if (r.type === "member") {
            showView("viewMembers");
            setTimeout(() => {
              const el = document.getElementById(`member-${r.id}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                
                // Open the accordion
                const header = el.querySelector('.member-accordion-header');
                if (header) header.click();
              }
            }, 100);
            
          } else if (r.type === "message") {
            showView("viewMessages");
            setTimeout(() => {
              const el = document.getElementById(`message-${r.id}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.style.animation = "pulse 2s";
                setTimeout(() => el.style.animation = "", 2000);
              }
            }, 100);
          }
        });
        
        box.appendChild(div);
      });
    }
  });
}

// ============================================
// APPLICATION BOOTSTRAP
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  showScreen("screenLogin");
  
  try {
    await ensureDefaultUsers();
    await loadUsers();
    handleLogin();
  } catch (error) {
    console.error("Application initialization error:", error);
    showToast("Application initialization failed. Please refresh.", "error");
  }
  
  // Handle online/offline status
  window.addEventListener('online', () => {
    showToast('You are back online', 'success');
  });
  
  window.addEventListener('offline', () => {
    showToast('You are offline. Some features may not work.', 'warning');
  });
});