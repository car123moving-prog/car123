// ===============================
// MOVEMENTS MANAGEMENT
// ===============================

import { db } from "./config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

import { getCurrentUser } from "./session.js";
import { formatDateTime } from "./utils.js";

// DOM elements
const addMovementForm = document.getElementById("addMovementForm");
const movementsList = document.getElementById("movementsList");
const addMovementError = document.getElementById("addMovementError");

// ===============================
// INIT SECTION
// ===============================

export function initMovementsSection() {
  if (addMovementForm) {
    addMovementForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      addMovementError.textContent = "";

      const user = getCurrentUser();
      if (!user) {
        addMovementError.textContent = "Session expired";
        return;
      }

      const type = document.getElementById("movementType").value;
      const carNumber = document.getElementById("movementCarNumber").value.trim();
      const plate = document.getElementById("movementPlate").value.trim();
      const person = document.getElementById("movementPerson").value.trim();
      const notes = document.getElementById("movementNotes").value.trim();

      if (!carNumber || !plate || !person) {
        addMovementError.textContent = "Please fill all required fields";
        return;
      }

      try {
        await addDoc(collection(db, "movements"), {
          type,
          carNumber,
          plate,
          person,
          notes,
          createdBy: user.displayName,
          userId: user.id,
          createdAt: Date.now()
        });

        addMovementForm.reset();
        loadMovementsList();

      } catch (err) {
        addMovementError.textContent = "Error adding movement";
        console.error(err);
      }
    });
  }

  loadMovementsList();
}

// ===============================
// LOAD MOVEMENTS LIST
// ===============================

async function loadMovementsList() {
  if (!movementsList) return;

  movementsList.innerHTML = "Loading...";

  try {
    const snap = await getDocs(collection(db, "movements"));

    if (snap.empty) {
      movementsList.innerHTML = "<div>No movements found</div>";
      return;
    }

    let html = "";

    snap.forEach((docSnap) => {
      const m = docSnap.data();
      const id = docSnap.id;

      html += `
        <div class="list-item">
          <div><strong>${m.type.toUpperCase()}</strong></div>
          <div>Car: ${m.carNumber}</div>
          <div>Plate: ${m.plate}</div>
          <div>Person: ${m.person}</div>
          <div>By: ${m.createdBy}</div>
          <div>Date: ${formatDateTime(m.createdAt)}</div>
          <div>Notes: ${m.notes || "-"}</div>

          <button class="btn-primary" style="margin-top:10px"
            onclick="deleteMovement('${id}')">
            DELETE
          </button>
        </div>
      `;
    });

    movementsList.innerHTML = html;

  } catch (err) {
    movementsList.innerHTML = "Error loading movements";
    console.error(err);
  }
}

// ===============================
// DELETE MOVEMENT
// ===============================

window.deleteMovement = async function (id) {
  if (!confirm("Delete this movement?")) return;

  try {
    await deleteDoc(doc(db, "movements", id));
    loadMovementsList();
  } catch (err) {
    alert("Error deleting movement");
    console.error(err);
  }
};
