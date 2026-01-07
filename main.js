const STORAGE_KEYS = {
  USERS: "cms_users",
  MOVEMENTS: "cms_movements",
  MESSAGES: "cms_messages",
  SESSION: "cms_session",
};

// TIMEZONE +4
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

function getArray(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function saveArray(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

function seedInitialData() {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    saveArray(STORAGE_KEYS.USERS, [
      {
        username: "admin",
        password: "1234",
        displayName: "Administrator",
        phone: "",
        role: "admin",
      },
      {
        username: "user1",
        password: "1234",
        displayName: "User One",
        phone: "",
        role: "user",
      },
    ]);
  }
  if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) {
    saveArray(STORAGE_KEYS.MOVEMENTS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
    saveArray(STORAGE_KEYS.MESSAGES, []);
  }
}

function saveSession(user) {
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
}

function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
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

let currentUser = null;

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

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showMessage(loginError, "Please enter username and password.");
      return;
    }

    const users = getArray(STORAGE_KEYS.USERS);
    const found = users.find(
      (u) => u.username === username && u.password === password
    );
    if (!found) {
      showMessage(loginError, "Invalid username or password.");
      return;
    }

    saveSession(found);
    enterApp(found);
  });
}

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
}

function updateUserBar() {
  const nameEl = document.getElementById("currentUserName");
  const roleEl = document.getElementById("currentUserRole");
  if (!currentUser) return;
  if (nameEl) nameEl.textContent = currentUser.displayName || currentUser.username;
  if (roleEl) roleEl.textContent = currentUser.role === "admin" ? "Administrator" : "User";
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

// MOVEMENTS
function renderDriverSelect() {
  const select = document.getElementById("movementDriverSelect");
  if (!select) return;
  const users = getArray(STORAGE_KEYS.USERS);
  select.innerHTML = "";
  users.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = `${u.displayName} (${u.username})`;
    select.appendChild(opt);
  });
}

function renderMovementsList() {
  const container = document.getElementById("movementsList");
  if (!container) return;
  const movements = getArray(STORAGE_KEYS.MOVEMENTS);

  if (movements.length === 0) {
    container.innerHTML = `<div class="info-text">No movements yet.</div>`;
    return;
  }

  container.innerHTML = "";
  movements
    .slice()
    .reverse()
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

  form.addEventListener("submit", (e) => {
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

    const users = getArray(STORAGE_KEYS.USERS);
    const driver = users.find((u) => u.username === driverUsername);
    const driverName = driver ? driver.displayName : driverUsername;

    const movements = getArray(STORAGE_KEYS.MOVEMENTS);
    const now = getGulfNow();

    const movement = {
      id: Date.now(),
      type,
      carNumber,
      plate,
      driverUsername,
      driverName,
      notes,
      createdBy: currentUser.username,
      date: formatDateTime(now),
    };

    movements.push(movement);
    saveArray(STORAGE_KEYS.MOVEMENTS, movements);
    renderMovementsList();
    form.reset();
    renderDriverSelect();
    showMessage(successBox, "Movement saved.", "success");
  });
}

function editMovement(id) {
  const movements = getArray(STORAGE_KEYS.MOVEMENTS);
  const m = movements.find((x) => x.id === id);
  if (!m) return;
  document.getElementById("movementType").value = m.type;
  document.getElementById("movementCarNumber").value = m.carNumber;
  document.getElementById("movementPlate").value = m.plate;
  document.getElementById("movementNotes").value = m.notes || "";
  document.getElementById("movementDriverSelect").value = m.driverUsername;
  deleteMovement(id, false);
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

function deleteMovement(id, rerender = true) {
  let movements = getArray(STORAGE_KEYS.MOVEMENTS);
  movements = movements.filter((m) => m.id !== id);
  saveArray(STORAGE_KEYS.MOVEMENTS, movements);
  if (rerender) renderMovementsList();
}

// MEMBERS
function renderMembersList() {
  const container = document.getElementById("membersList");
  if (!container) return;
  const users = getArray(STORAGE_KEYS.USERS);

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

function renderMessageTargets() {
  const select = document.getElementById("messageTarget");
  if (!select) return;
  const users = getArray(STORAGE_KEYS.USERS);
  select.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All";
  select.appendChild(optAll);

  users.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.username;
    opt.textContent = `${u.displayName} (${u.username})`;
    select.appendChild(opt);
  });
}

function renderStatsUsers() {
  const select = document.getElementById("statsUserSelect");
  if (!select) return;
  const users = getArray(STORAGE_KEYS.USERS);
  select.innerHTML = "";
  users.forEach((u) => {
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

  form.addEventListener("submit", (e) => {
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

    const users = getArray(STORAGE_KEYS.USERS);
    if (users.find((u) => u.username === username)) {
      showMessage(errorBox, "Username already exists.");
      return;
    }

    users.push({ username, password, displayName, phone, role });
    saveArray(STORAGE_KEYS.USERS, users);
    form.reset();
    renderMembersList();
    renderDriverSelect();
    renderMessageTargets();
    renderStatsUsers();
    showMessage(successBox, "Member saved.", "success");
  });
}

// MESSAGES
function renderMessagesList() {
  const container = document.getElementById("messagesList");
  if (!container) return;
  const messages = getArray(STORAGE_KEYS.MESSAGES);

  if (messages.length === 0) {
    container.innerHTML = `<div class="info-text">No messages.</div>`;
    return;
  }

  container.innerHTML = "";
  messages
    .slice()
    .reverse()
    .forEach((msg) => {
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

function initMessages() {
  renderMessageTargets();
  renderMessagesList();

  const form = document.getElementById("sendMessageForm");
  const errorBox = document.getElementById("sendMessageError");
  const successBox = document.getElementById("sendMessageSuccess");
  const textArea = document.getElementById("messageText");

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const target = document.getElementById("messageTarget").value;
    const text = textArea.value.trim();

    if (!text) {
      showMessage(errorBox, "Message cannot be empty.");
      return;
    }

    const users = getArray(STORAGE_KEYS.USERS);
    let toLabel = "All";
    if (target !== "all") {
      const u = users.find((x) => x.username === target);
      toLabel = u ? `${u.displayName} (${u.username})` : target;
    }

    const messages = getArray(STORAGE_KEYS.MESSAGES);
    const now = getGulfNow();

    messages.push({
      id: Date.now(),
      from: currentUser.displayName || currentUser.username,
      to: target,
      toLabel,
      text,
      date: formatDateTime(now),
    });

    saveArray(STORAGE_KEYS.MESSAGES, messages);
    form.reset();
    renderMessagesList();
    showMessage(successBox, "Message sent.", "success");
  });
}

// STATISTICS
function updateStatsSummary() {
  const box = document.getElementById("statsSummaryBox");
  if (!box) return;

  const movements = getArray(STORAGE_KEYS.MOVEMENTS);
  const total = movements.length;
  const received = movements.filter((m) => m.type === "receive").length;
  const delivered = movements.filter((m) => m.type === "deliver").length;

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
      const movements = getArray(STORAGE_KEYS.MOVEMENTS);
      const fromDate = document.getElementById("statsFromDate").value;
      const toDate = document.getElementById("statsToDate").value;

      if (!fromDate || !toDate) {
        rangeResult.textContent = "Please select both dates.";
        return;
      }

      const fromTime = new Date(fromDate + "T00:00:00").getTime();
      const toTime = new Date(toDate + "T23:59:59").getTime();

      const filtered = movements.filter((m) => {
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
      const movements = getArray(STORAGE_KEYS.MOVEMENTS);
      const selected = document.getElementById("statsUserSelect").value;
      const count = movements.filter(
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
      const movements = getArray(STORAGE_KEYS.MOVEMENTS);
      const carNumber = document.getElementById("statsCarNumber").value.trim();
      if (!carNumber) {
        carResult.textContent = "Please enter car number.";
        return;
      }
      const count = movements.filter(
        (m) => m.carNumber.toLowerCase() === carNumber.toLowerCase()
      ).length;
      carResult.textContent = `Movements for this car: ${count}`;
    });
  }
}

// SETTINGS
function initSettings() {
  const passForm = document.getElementById("changePasswordForm");
  const passError = document.getElementById("changePasswordError");
  const passSuccess = document.getElementById("changePasswordSuccess");

  const phoneForm = document.getElementById("changePhoneForm");
  const phoneError = document.getElementById("changePhoneError");
  const phoneSuccess = document.getElementById("changePhoneSuccess");

  if (passForm) {
    passForm.addEventListener("submit", (e) => {
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

      const users = getArray(STORAGE_KEYS.USERS);
      const idx = users.findIndex((u) => u.username === currentUser.username);
      if (idx === -1) {
        showMessage(passError, "User not found.");
        return;
      }

      if (users[idx].password !== oldPassword) {
        showMessage(passError, "Current password is incorrect.");
        return;
      }

      users[idx].password = newPassword;
      saveArray(STORAGE_KEYS.USERS, users);
      currentUser.password = newPassword;
      saveSession(currentUser);
      showMessage(passSuccess, "Password updated.", "success");
      passForm.reset();
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

      const users = getArray(STORAGE_KEYS.USERS);
      const idx = users.findIndex((u) => u.username === currentUser.username);
      if (idx === -1) {
        showMessage(phoneError, "User not found.");
        return;
      }

      users[idx].phone = newPhone;
      saveArray(STORAGE_KEYS.USERS, users);
      currentUser.phone = newPhone;
      saveSession(currentUser);
      showMessage(phoneSuccess, "Phone updated.", "success");
      phoneForm.reset();
    });
  }
}

// GLOBAL SEARCH (يقفز للعنصر)
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

    const movements = getArray(STORAGE_KEYS.MOVEMENTS);
    const users = getArray(STORAGE_KEYS.USERS);
    const messages = getArray(STORAGE_KEYS.MESSAGES);

    const results = [];

    movements.forEach((m) => {
      const text = `${m.carNumber} ${m.plate} ${m.driverName} ${m.notes}`.toLowerCase();
      if (text.includes(term)) {
        results.push({
          type: "movement",
          id: m.id,
          label: `Movement: ${m.carNumber} / ${m.plate} / ${m.driverName}`,
        });
      }
    });

    users.forEach((u) => {
      const text = `${u.username} ${u.displayName} ${u.phone}`.toLowerCase();
      if (text.includes(term)) {
        results.push({
          type: "member",
          id: u.username,
          label: `Member: ${u.displayName} (${u.username})`,
        });
      }
    });

    messages.forEach((msg) => {
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

// LOGOUT
function initLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;
  logoutBtn.addEventListener("click", () => {
    clearSession();
    currentUser = null;
    showScreen("screenLogin");
  });
}

// PWA
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", () => {
  seedInitialData();
  registerServiceWorker();
  initLogin();
});
