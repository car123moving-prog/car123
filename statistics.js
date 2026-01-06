// ===============================
// STATISTICS MANAGEMENT
// ===============================

import { db } from "./config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

import { formatDateTime } from "./utils.js";

// DOM elements
const statsSummaryBox = document.getElementById("statsSummaryBox");
const statsRangeForm = document.getElementById("statsRangeForm");
const statsRangeResult = document.getElementById("statsRangeResult");
const statsUserForm = document.getElementById("statsUserForm");
const statsUserSelect = document.getElementById("statsUserSelect");
const statsUserResult = document.getElementById("statsUserResult");
const statsCarForm = document.getElementById("statsCarForm");
const statsCarResult = document.getElementById("statsCarResult");

// ===============================
// INIT SECTION
// ===============================

export function initStatisticsSection() {
  loadSummary();
  loadUsersList();

  if (statsRangeForm) {
    statsRangeForm.addEventListener("submit", (e) => {
      e.preventDefault();
      calculateRangeStats();
    });
  }

  if (statsUserForm) {
    statsUserForm.addEventListener("submit", (e) => {
      e.preventDefault();
      calculateUserStats();
    });
  }

  if (statsCarForm) {
    statsCarForm.addEventListener("submit", (e) => {
      e.preventDefault();
      calculateCarStats();
    });
  }
}

// ===============================
// LOAD SUMMARY
// ===============================

async function loadSummary() {
  if (!statsSummaryBox) return;

  statsSummaryBox.innerHTML = "Loading...";

  try {
    const snap = await getDocs(collection(db, "movements"));

    let total = 0;
    let receive = 0;
    let deliver = 0;

    snap.forEach((docSnap) => {
      const m = docSnap.data();
      total++;
      if (m.type === "receive") receive++;
      if (m.type === "deliver") deliver++;
    });

    statsSummaryBox.innerHTML = `
      <div>Total movements: <strong>${total}</strong></div>
      <div>Received: <strong>${receive}</strong></div>
      <div>Delivered: <strong>${deliver}</strong></div>
    `;

  } catch (err) {
    statsSummaryBox.innerHTML = "Error loading statistics";
    console.error(err);
  }
}

// ===============================
// LOAD USERS LIST
// ===============================

async function loadUsersList() {
  if (!statsUserSelect) return;

  try {
    const snap = await getDocs(collection(db, "members"));

    let html = "";

    snap.forEach((docSnap) => {
      const m = docSnap.data();
      html += `<option value="${m.displayName}">${m.displayName}</option>`;
    });

    statsUserSelect.innerHTML = html;

  } catch (err) {
    console.error("Error loading users list", err);
  }
}

// ===============================
// RANGE STATISTICS
// ===============================

async function calculateRangeStats() {
  const from = document.getElementById("statsFromDate").value;
  const to = document.getElementById("statsToDate").value;

  if (!from || !to) {
    statsRangeResult.innerHTML = "Please select both dates";
    return;
  }

  const fromTS = new Date(from).getTime();
  const toTS = new Date(to).getTime() + 86400000;

  try {
    const snap = await getDocs(collection(db, "movements"));

    let total = 0;
    let receive = 0;
    let deliver = 0;

    snap.forEach((docSnap) => {
      const m = docSnap.data();
      if (m.createdAt >= fromTS && m.createdAt <= toTS) {
        total++;
        if (m.type === "receive") receive++;
        if (m.type === "deliver") deliver++;
      }
    });

    statsRangeResult.innerHTML = `
      <div>Total: <strong>${total}</strong></div>
      <div>Received: <strong>${receive}</strong></div>
      <div>Delivered: <strong>${deliver}</strong></div>
    `;

  } catch (err) {
    statsRangeResult.innerHTML = "Error calculating statistics";
    console.error(err);
  }
}

// ===============================
// USER STATISTICS
// ===============================

async function calculateUserStats() {
  const user = statsUserSelect.value;

  try {
    const q = query(collection(db, "movements"), where("createdBy", "==", user));
    const snap = await getDocs(q);

    let total = 0;
    let receive = 0;
    let deliver = 0;

    snap.forEach((docSnap) => {
      const m = docSnap.data();
      total++;
      if (m.type === "receive") receive++;
      if (m.type === "deliver") deliver++;
    });

    statsUserResult.innerHTML = `
      <div>User: <strong>${user}</strong></div>
      <div>Total: <strong>${total}</strong></div>
      <div>Received: <strong>${receive}</strong></div>
      <div>Delivered: <strong>${deliver}</strong></div>
    `;

  } catch (err) {
    statsUserResult.innerHTML = "Error calculating user statistics";
    console.error(err);
  }
}

// ===============================
// CAR STATISTICS
// ===============================

async function calculateCarStats() {
  const car = document.getElementById("statsCarNumber").value.trim();

  if (!car) {
    statsCarResult.innerHTML = "Please enter a car number";
    return;
  }

  try {
    const q = query(collection(db, "movements"), where("carNumber", "==", car));
    const snap = await getDocs(q);

    let total = 0;
    let receive = 0;
    let deliver = 0;

    snap.forEach((docSnap) => {
      const m = docSnap.data();
      total++;
      if (m.type === "receive") receive++;
      if (m.type === "deliver") deliver++;
    });

    statsCarResult.innerHTML = `
      <div>Car: <strong>${car}</strong></div>
      <div>Total: <strong>${total}</strong></div>
      <div>Received: <strong>${receive}</strong></div>
      <div>Delivered: <strong>${deliver}</strong></div>
    `;

  } catch (err) {
    statsCarResult.innerHTML = "Error calculating car statistics";
    console.error(err);
  }
}
