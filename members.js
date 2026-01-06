// ===============================
// MEMBERS MANAGEMENT
// ===============================

import { db } from "./config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

import { formatDateTime } from "./utils.js";

// DOM elements
const addMemberForm = document.getElementById("addMemberForm");
const membersList = document.getElementById("membersList");
const addMemberError = document.getElementById("addMemberError");

// ===============================
// ADD MEMBER
// ===============================

export function initMembersSection() {
  if (addMemberForm) {
    addMemberForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      addMemberError.textContent = "";

      const username = document.getElementById("memberUsername").value.trim();
      const password = document.getElementById("memberPassword").value.trim();
      const displayName = document.getElementById("memberDisplayName").value.trim();
      const phone = document.getElementById("memberPhone").value.trim();
      const role = document.getElementById("memberRole").value;

      if (!username || !password || !displayName) {
        addMemberError.textContent = "Please fill all required fields";
        return;
      }

      try {
        await addDoc(collection(db, "members"), {
          username,
          password,
          displayName,
          phone,
          role,
          createdAt: Date.now()
        });

        addMemberForm.reset();
        loadMembersList();

      } catch (err) {
        addMemberError.textContent = "Error adding member";
        console.error(err);
      }
    });
  }

  loadMembersList();
}

// ===============================
// LOAD MEMBERS LIST
// ===============================

async function loadMembersList() {
  if (!membersList) return;

  membersList.innerHTML = "Loading...";

  try {
    const snap = await getDocs(collection(db, "members"));

    if (snap.empty) {
      membersList.innerHTML = "<div>No members found</div>";
      return;
    }

    let html = "";

    snap.forEach((docSnap) => {
      const m = docSnap.data();
      const id = docSnap.id;

      html += `
        <div class="list-item">
          <div><strong>${m.displayName}</strong> (${m.role})</div>
          <div>Username: ${m.username}</div>
          <div>Phone: ${m.phone || "-"}</div>
          <div>Created: ${formatDateTime(m.createdAt)}</div>

          <button class="btn-primary" style="margin-top:10px"
            onclick="deleteMember('${id}')">
            DELETE
          </button>
        </div>
      `;
    });

    membersList.innerHTML = html;

  } catch (err) {
    membersList.innerHTML = "Error loading members";
    console.error(err);
  }
}

// ===============================
// DELETE MEMBER
// ===============================

window.deleteMember = async function (id) {
  if (!confirm("Delete this member?")) return;

  try {
    await deleteDoc(doc(db, "members", id));
    loadMembersList();
  } catch (err) {
    alert("Error deleting member");
    console.error(err);
  }
};
