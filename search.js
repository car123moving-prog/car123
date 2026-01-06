// ===============================
// GLOBAL SEARCH (MEMBERS + MOVEMENTS)
// ===============================

import { db } from "./config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

import { shorten, formatDateTime } from "./utils.js";

// DOM elements
const globalSearchInput = document.getElementById("globalSearchInput");
const globalSearchResults = document.getElementById("globalSearchResults");

// ===============================
// INIT SEARCH
// ===============================

export function initGlobalSearch() {
  if (!globalSearchInput) return;

  globalSearchInput.addEventListener("input", async () => {
    const text = globalSearchInput.value.trim().toLowerCase();

    if (!text) {
      globalSearchResults.style.display = "none";
      globalSearchResults.innerHTML = "";
      return;
    }

    globalSearchResults.style.display = "block";
    globalSearchResults.innerHTML = "Searching...";

    const members = await searchMembers(text);
    const movements = await searchMovements(text);

    renderResults(members, movements);
  });
}

// ===============================
// SEARCH MEMBERS
// ===============================

async function searchMembers(text) {
  const snap = await getDocs(collection(db, "members"));
  const results = [];

  snap.forEach((docSnap) => {
    const m = docSnap.data();

    if (
      m.username.toLowerCase().includes(text) ||
      m.displayName.toLowerCase().includes(text) ||
      (m.phone || "").toLowerCase().includes(text)
    ) {
      results.push({
        type: "member",
        name: m.displayName,
        username: m.username,
        phone: m.phone || "-"
      });
    }
  });

  return results;
}

// ===============================
// SEARCH MOVEMENTS
// ===============================

async function searchMovements(text) {
  const snap = await getDocs(collection(db, "movements"));
  const results = [];

  snap.forEach((docSnap) => {
    const m = docSnap.data();

    if (
      m.carNumber.toLowerCase().includes(text) ||
      m.plate.toLowerCase().includes(text) ||
      m.person.toLowerCase().includes(text) ||
      (m.notes || "").toLowerCase().includes(text)
    ) {
      results.push({
        type: "movement",
        movementType: m.type,
        carNumber: m.carNumber,
        plate: m.plate,
        person: m.person,
        notes: m.notes || "-",
        date: formatDateTime(m.createdAt)
      });
    }
  });

  return results;
}

// ===============================
// RENDER RESULTS
// ===============================

function renderResults(members, movements) {
  let html = "";

  if (members.length === 0 && movements.length === 0) {
    globalSearchResults.innerHTML = "<div>No results found</div>";
    return;
  }

  if (members.length > 0) {
    html += `<div><strong>Members</strong></div>`;
    members.forEach((m) => {
      html += `
        <div class="list-item">
          <div><strong>${m.name}</strong></div>
          <div>Username: ${m.username}</div>
          <div>Phone: ${m.phone}</div>
        </div>
      `;
    });
  }

  if (movements.length > 0) {
    html += `<div style="margin-top:10px"><strong>Movements</strong></div>`;
    movements.forEach((m) => {
      html += `
        <div class="list-item">
          <div><strong>${m.movementType.toUpperCase()}</strong></div>
          <div>Car: ${m.carNumber}</div>
          <div>Plate: ${m.plate}</div>
          <div>Person: ${m.person}</div>
          <div>Date: ${m.date}</div>
          <div>Notes: ${shorten(m.notes, 40)}</div>
        </div>
      `;
    });
  }

  globalSearchResults.innerHTML = html;
}
