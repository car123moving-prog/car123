// ===============================
// Simple local "database" using localStorage
// ===============================

const STORAGE_KEYS = {
  USERS: "car_users",
  MOVEMENTS: "car_movements",
  MESSAGES: "car_messages",
  SESSION: "carUser",
};

// Initial seed data
function seedInitialData() {
  const usersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!usersRaw) {
    const defaultUsers = [
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
    ];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
  }

  if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) {
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
  }

  if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify([]));
  }
}

// Helpers to get/save arrays
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

// ===============================
// Session Management
// ===============================

function saveSession(user) {
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
}

function getCurrentUser() {
  const data = localStorage.getItem(STORAGE_KEYS.SESSION);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

// ===============================
// LOGIN PAGE LOGIC
// ===============================

function initLoginPage() {
  seedInitialData();

  const existingUser = getCurrentUser();
  if (existingUser) {
    window.location.href = "index.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const errorBox = document.getElementById("loginError");

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      errorBox.textContent = "Please enter username and password.";
      return;
    }

    const users = getArray(STORAGE_KEYS.USERS);
    const found = users.find(
      (u) => u.username === username && u.password === password
    );

    if (!found) {
      errorBox.textContent = "Invalid username or password.";
      return;
    }

    saveSession(found);
    window.location.href = "index.html";
  });
}

// ===============================
// ACCORDIONS + SIDEBAR
// ===============================

function setupAccordions() {
  const headers = document.querySelectorAll(".accordion-header");
  headers.forEach((header) => {
    header.addEventListener("click", () => {
      const body = header.nextElementSibling;
      if (!body) return;
      body.classList.toggle("open");
    });
  });
}

function setupSidebarNavigation() {
  const buttons = document.querySelectorAll(".sidebar-btn");
  const sections = document.querySelectorAll(".page-section");

  function activateSection(targetId) {
    sections.forEach((sec) => {
      sec.classList.toggle("active", sec.id === targetId);
    });
  }

  buttons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      activateSection(target);
    });
    // افتراضياً أول زر يفتح أول قسم
    if (index === 0) {
      const target = btn.getAttribute("data-target");
      activateSection(target);
    }
  });
}

function applyRoleVisibility(role) {
  const adminOnly = document.querySelectorAll('[data-role="admin"]');
  adminOnly.forEach((el) => {
    if (role !== "admin") {
      el.classList.add("hidden");
    }
  });
}

// ===============================
// MEMBERS SECTION
// ===============================

function renderMembersList() {
  const container = document.getElementById("membersList");
  if (!container) return;
  const users = getArray(STORAGE_KEYS.USERS);

  if (users.length === 0) {
    container.textContent = "No members.";
    return;
  }

  container.innerHTML = "";
  users.forEach((u) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.textContent = `${u.displayName} (${u.username}) - ${u.role} - ${u.phone || "No phone"}`;
    container.appendChild(div);
  });
}

function initMembersSection() {
  renderMembersList();

  const form = document.getElementById("addMemberForm");
  const errorBox = document.getElementById("addMemberError");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const username = document.getElementById("memberUsername").value.trim();
    const password = document.getElementById("memberPassword").value.trim();
    const displayName = document
      .getElementById("memberDisplayName")
      .value.trim();
    const phone = document.getElementById("memberPhone").value.trim();
    const role = document.getElementById("memberRole").value;

    if (!username || !password || !displayName) {
      errorBox.textContent = "Please fill all required fields.";
      return;
    }

    const users = getArray(STORAGE_KEYS.USERS);
    if (users.find((u) => u.username === username)) {
      errorBox.textContent = "Username already exists.";
      return;
    }

    users.push({
      username,
      password,
      displayName,
      phone,
      role,
    });
    saveArray(STORAGE_KEYS.USERS, users);
    renderMembersList();
    form.reset();
  });
}

// ===============================
// MOVEMENTS SECTION
// ===============================

function renderMovementsList() {
  const container = document.getElementById("movementsList");
  if (!container) return;

  const movements = getArray(STORAGE_KEYS.MOVEMENTS);
  if (movements.length === 0) {
    container.textContent = "No movements.";
    return;
  }

  container.innerHTML = "";
  movements
    .slice()
    .reverse()
    .forEach((m) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.textContent = `[${m.type.toUpperCase()}] Car: ${m.carNumber}, Plate: ${
        m.plate
      }, Person: ${m.person}, By: ${m.createdBy}, Date: ${m.date}, Notes: ${
        m.notes || "-"
      }`;
      container.appendChild(div);
    });
}

function initMovementsSection(currentUser) {
  renderMovementsList();

  const form = document.getElementById("addMovementForm");
  const errorBox = document.getElementById("addMovementError");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const type = document.getElementById("movementType").value;
    const carNumber = document
      .getElementById("movementCarNumber")
      .value.trim();
    const plate = document.getElementById("movementPlate").value.trim();
    const person = document.getElementById("movementPerson").value.trim();
    const notes = document.getElementById("movementNotes").value.trim();

    if (!carNumber || !plate || !person) {
      errorBox.textContent = "Please fill all required fields.";
      return;
    }

    const movements = getArray(STORAGE_KEYS.MOVEMENTS);
    const now = new Date();
    movements.push({
      type,
      carNumber,
      plate,
      person,
      notes,
      createdBy: currentUser.displayName || currentUser.username,
      date: now.toISOString().slice(0, 19).replace("T", " "),
    });
    saveArray(STORAGE_KEYS.MOVEMENTS, movements);
    renderMovementsList();
    form.reset();
  });
}

// ===============================
// STATISTICS SECTION
// ===============================

function updateStatsSummary() {
  const box = document.getElementById("statsSummaryBox");
  if (!box) return;

  const movements = getArray(STORAGE_KEYS.MOVEMENTS);
  const total = movements.length;
  const received = movements.filter((m) => m.type === "receive").length;
  const delivered = movements.filter((m) => m.type === "deliver").length;

  box.innerHTML = `
    <div>Total movements: ${total}</div>
    <div>Received: ${received}</div>
    <div>Delivered: ${delivered}</div>
  `;
}

function initStatisticsSection() {
  updateStatsSummary();

  const movements = getArray(STORAGE_KEYS.MOVEMENTS);
  const users = getArray(STORAGE_KEYS.USERS);

  // By date range
  const formRange = document.getElementById("statsRangeForm");
  const rangeResult = document.getElementById("statsRangeResult");
  if (formRange) {
    formRange.addEventListener("submit", (e) => {
      e.preventDefault();
      rangeResult.textContent = "";

      const fromDate = document.getElementById("statsFromDate").value;
      const toDate = document.getElementById("statsToDate").value;

      if (!fromDate || !toDate) {
        rangeResult.textContent = "Please select both dates.";
        return;
      }

      const fromTime = new Date(fromDate).getTime();
      const toTime = new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1;

      const filtered = movements.filter((m) => {
        const t = new Date(m.date).getTime();
        return t >= fromTime && t <= toTime;
      });

      rangeResult.textContent = `Movements in range: ${filtered.length}`;
    });
  }

  // By user
  const userSelect = document.getElementById("statsUserSelect");
  const formUser = document.getElementById("statsUserForm");
  const userResult = document.getElementById("statsUserResult");

  if (userSelect && formUser) {
    userSelect.innerHTML = "";
    users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = `${u.displayName} (${u.username})`;
      userSelect.appendChild(opt);
    });

    formUser.addEventListener("submit", (e) => {
      e.preventDefault();
      userResult.textContent = "";
      const selected = userSelect.value;

      const filtered = movements.filter(
        (m) => m.createdBy === selected || m.createdBy === ""
      );

      const count = movements.filter((m) => m.createdBy === selected).length;
      userResult.textContent = `Movements by this user: ${count}`;
    });
  }

  // By car
  const formCar = document.getElementById("statsCarForm");
  const carResult = document.getElementById("statsCarResult");

  if (formCar) {
    formCar.addEventListener("submit", (e) => {
      e.preventDefault();
      carResult.textContent = "";
      const carNumber = document
        .getElementById("statsCarNumber")
        .value.trim();
      if (!carNumber) {
        carResult.textContent = "Please enter car number.";
        return;
      }

      const filtered = movements.filter(
        (m) => m.carNumber.toLowerCase() === carNumber.toLowerCase()
      );
      carResult.textContent = `Movements for this car: ${filtered.length}`;
    });
  }
}

// ===============================
// MESSAGES SECTION
// ===============================

function renderMessagesList() {
  const container = document.getElementById("messagesList");
  if (!container) return;

  const messages = getArray(STORAGE_KEYS.MESSAGES);
  if (messages.length === 0) {
    container.textContent = "No messages.";
    return;
  }

  container.innerHTML = "";
  messages
    .slice()
    .reverse()
    .forEach((msg) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.textContent = `[${msg.date}] ${msg.from}: ${msg.text}`;
      container.appendChild(div);
    });
}

function initMessagesSection(currentUser) {
  renderMessagesList();

  const form = document.getElementById("sendMessageForm");
  const errorBox = document.getElementById("sendMessageError");
  const textArea = document.getElementById("messageText");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const text = textArea.value.trim();
    if (!text) {
      errorBox.textContent = "Message cannot be empty.";
      return;
    }

    const messages = getArray(STORAGE_KEYS.MESSAGES);
    const now = new Date();
    messages.push({
      from: currentUser.displayName || currentUser.username,
      text,
      date: now.toISOString().slice(0, 19).replace("T", " "),
    });
    saveArray(STORAGE_KEYS.MESSAGES, messages);
    renderMessagesList();
    form.reset();
  });
}

// ===============================
// SETTINGS SECTION
// ===============================

function initSettingsSection(currentUser) {
  const changePassForm = document.getElementById("changePasswordForm");
  const passError = document.getElementById("changePasswordError");
  const passSuccess = document.getElementById("changePasswordSuccess");

  const changePhoneForm = document.getElementById("changePhoneForm");
  const phoneError = document.getElementById("changePhoneError");
  const phoneSuccess = document.getElementById("changePhoneSuccess");

  if (changePassForm) {
    changePassForm.addEventListener("submit", (e) => {
      e.preventDefault();
      passError.textContent = "";
      passSuccess.textContent = "";

      const oldPassword = document
        .getElementById("oldPassword")
        .value.trim();
      const newPassword = document
        .getElementById("newPassword")
        .value.trim();
      const confirmPassword = document
        .getElementById("confirmPassword")
        .value.trim();

      if (!oldPassword || !newPassword || !confirmPassword) {
        passError.textContent = "Please fill all fields.";
        return;
      }

      if (newPassword !== confirmPassword) {
        passError.textContent = "New passwords do not match.";
        return;
      }

      const users = getArray(STORAGE_KEYS.USERS);
      const idx = users.findIndex(
        (u) => u.username === currentUser.username
      );
      if (idx === -1) {
        passError.textContent = "User not found.";
        return;
      }

      if (users[idx].password !== oldPassword) {
        passError.textContent = "Current password is incorrect.";
        return;
      }

      users[idx].password = newPassword;
      saveArray(STORAGE_KEYS.USERS, users);
      currentUser.password = newPassword;
      saveSession(currentUser);

      passSuccess.textContent = "Password updated successfully.";
      changePassForm.reset();
    });
  }

  if (changePhoneForm) {
    changePhoneForm.addEventListener("submit", (e) => {
      e.preventDefault();
      phoneError.textContent = "";
      phoneSuccess.textContent = "";

      const newPhone = document.getElementById("newPhone").value.trim();
      if (!newPhone) {
        phoneError.textContent = "Please enter phone.";
        return;
      }

      const users = getArray(STORAGE_KEYS.USERS);
      const idx = users.findIndex(
        (u) => u.username === currentUser.username
      );
      if (idx === -1) {
        phoneError.textContent = "User not found.";
        return;
      }

      users[idx].phone = newPhone;
      saveArray(STORAGE_KEYS.USERS, users);
      currentUser.phone = newPhone;
      saveSession(currentUser);

      phoneSuccess.textContent = "Phone updated successfully.";
      changePhoneForm.reset();
    });
  }
}

// ===============================
// GLOBAL SEARCH
// ===============================

function initGlobalSearch() {
  const input = document.getElementById("globalSearchInput");
  const box = document.getElementById("globalSearchResults");
  if (!input || !box) return;

  function performSearch(term) {
    const t = term.toLowerCase();
    const movements = getArray(STORAGE_KEYS.MOVEMENTS);
    const users = getArray(STORAGE_KEYS.USERS);
    const messages = getArray(STORAGE_KEYS.MESSAGES);

    const results = [];

    movements.forEach((m) => {
      const text = `${m.carNumber} ${m.plate} ${m.person} ${m.notes}`.toLowerCase();
      if (text.includes(t)) {
        results.push(`Movement: ${m.carNumber} / ${m.plate} / ${m.person}`);
      }
    });

    users.forEach((u) => {
      const text = `${u.username} ${u.displayName} ${u.phone}`.toLowerCase();
      if (text.includes(t)) {
        results.push(`User: ${u.displayName} (${u.username})`);
      }
    });

    messages.forEach((msg) => {
      const text = `${msg.text} ${msg.from}`.toLowerCase();
      if (text.includes(t)) {
        results.push(`Message: ${msg.text}`);
      }
    });

    return results;
  }

  input.addEventListener("input", () => {
    const term = input.value.trim();
    if (!term) {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }

    const results = performSearch(term);
    if (results.length === 0) {
      box.innerHTML = "<div>No results.</div>";
    } else {
      box.innerHTML = "";
      results.forEach((r) => {
        const div = document.createElement("div");
        div.className = "search-result-item";
        div.textContent = r;
        box.appendChild(div);
      });
    }
    box.style.display = "block";
  });

  document.addEventListener("click", (e) => {
    if (!box.contains(e.target) && e.target !== input) {
      box.style.display = "none";
    }
  });
}

// ===============================
// MAIN ENTRY
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  const isLoginPage = !!document.getElementById("loginForm");

  if (isLoginPage) {
    initLoginPage();
    return;
  }

  // Index page
  seedInitialData();

  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Show user info
  const userBox = document.getElementById("currentUserBox");
  if (userBox) {
    userBox.textContent = `${user.displayName} (${user.role})`;
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "login.html";
    });
  }

  setupAccordions();
  setupSidebarNavigation();
  applyRoleVisibility(user.role);

  initMembersSection();
  initMovementsSection(user);
  initStatisticsSection();
  initMessagesSection(user);
  initSettingsSection(user);
  initGlobalSearch();
});
