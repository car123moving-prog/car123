// ===============================
// AUTHENTICATION (LOGIN PAGE)
// ===============================

import { db } from "./config.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

import { saveSession } from "./session.js";

// Login form
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      loginError.textContent = "Please enter username and password";
      return;
    }

    try {
      const q = query(
        collection(db, "members"),
        where("username", "==", username),
        where("password", "==", password)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        loginError.textContent = "Invalid username or password";
        return;
      }

      // User found
      const user = snap.docs[0].data();
      user.id = snap.docs[0].id;

      saveSession(user);

      // Redirect to main page
      window.location.href = "index.html";

    } catch (err) {
      loginError.textContent = "Error connecting to server";
      console.error(err);
    }
  });
}
