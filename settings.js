// ===============================
// SETTINGS MANAGEMENT
// ===============================

import { db } from "./config.js";
import {
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

import { getCurrentUser, saveSession } from "./session.js";

// DOM elements
const changePasswordForm = document.getElementById("changePasswordForm");
const changePasswordError = document.getElementById("changePasswordError");
const changePasswordSuccess = document.getElementById("changePasswordSuccess");

const changePhoneForm = document.getElementById("changePhoneForm");
const changePhoneError = document.getElementById("changePhoneError");
const changePhoneSuccess = document.getElementById("changePhoneSuccess");

// ===============================
// INIT SECTION
// ===============================

export function initSettingsSection() {
  if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      changePasswordError.textContent = "";
      changePasswordSuccess.textContent = "";

      const user = getCurrentUser();
      if (!user) {
        changePasswordError.textContent = "Session expired";
        return;
      }

      const oldPass = document.getElementById("oldPassword").value.trim();
      const newPass = document.getElementById("newPassword").value.trim();
      const confirmPass = document.getElementById("confirmPassword").value.trim();

      if (!oldPass || !newPass || !confirmPass) {
        changePasswordError.textContent = "Please fill all fields";
        return;
      }

      if (oldPass !== user.password) {
        changePasswordError.textContent = "Current password is incorrect";
        return;
      }

      if (newPass !== confirmPass) {
        changePasswordError.textContent = "New passwords do not match";
        return;
      }

      try {
        await updateDoc(doc(db, "members", user.id), {
          password: newPass
        });

        user.password = newPass;
        saveSession(user);

        changePasswordSuccess.textContent = "Password updated successfully";
        changePasswordForm.reset();

      } catch (err) {
        changePasswordError.textContent = "Error updating password";
        console.error(err);
      }
    });
  }

  if (changePhoneForm) {
    changePhoneForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      changePhoneError.textContent = "";
      changePhoneSuccess.textContent = "";

      const user = getCurrentUser();
      if (!user) {
        changePhoneError.textContent = "Session expired";
        return;
      }

      const newPhone = document.getElementById("newPhone").value.trim();

      try {
        await updateDoc(doc(db, "members", user.id), {
          phone: newPhone
        });

        user.phone = newPhone;
        saveSession(user);

        changePhoneSuccess.textContent = "Phone updated successfully";
        changePhoneForm.reset();

      } catch (err) {
        changePhoneError.textContent = "Error updating phone";
        console.error(err);
      }
    });
  }
}
