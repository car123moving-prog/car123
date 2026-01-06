// ===============================
// MAIN APP CONTROLLER
// ===============================

import { getCurrentUser, clearSession } from "./session.js";
import { setupAccordions, applyRoleVisibility } from "./ui.js";

import { initMembersSection } from "./members.js";
import { initMovementsSection } from "./movements.js";
import { initStatisticsSection } from "./statistics.js";
import { initMessagesSection } from "./messages.js";
import { initSettingsSection } from "./settings.js";
import { initGlobalSearch } from "./search.js";

// ===============================
// INITIALIZATION
// ===============================

window.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();

  // If no session → redirect to login
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Show user info
  const userBox = document.getElementById("currentUserBox");
  if (userBox) {
    userBox.textContent = `${user.displayName} (${user.role})`;
  }

  // Logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "login.html";
    });
  }

  // Setup UI
  setupAccordions();
  applyRoleVisibility(user.role);

  // Initialize sections
  initMembersSection();
  initMovementsSection();
  initStatisticsSection();
  initMessagesSection();
  initSettingsSection();
  initGlobalSearch();
});
