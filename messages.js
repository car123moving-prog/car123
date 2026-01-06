// ===============================
// MESSAGES MANAGEMENT
// ===============================

import { db } from "./config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

import { getCurrentUser } from "./session.js";
import { formatDateTime } from "./utils.js";

// DOM elements
const sendMessageForm = document.getElementById("sendMessageForm");
const messageTarget = document.getElementById("messageTarget");
const messageText = document.getElementById("messageText");
const sendMessageError = document.getElementById("sendMessageError");
const messagesList = document.getElementById("messagesList");

// ===============================
// INIT SECTION
// ===============================

export function initMessagesSection() {
  if (sendMessageForm) {
    sendMessageForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      sendMessageError.textContent = "";

      const user = getCurrentUser();
      if (!user) {
        sendMessageError.textContent = "Session expired";
        return;
      }

      const target = messageTarget.value;
      const text = messageText.value.trim();

      if (!text) {
        sendMessageError.textContent = "Message cannot be empty";
        return;
      }

      try {
        await addDoc(collection(db, "messages"), {
          from: user.displayName,
          to: target,
          text,
          createdAt: Date.now()
        });

        sendMessageForm.reset();
        loadMessagesList();

      } catch (err) {
        sendMessageError.textContent = "Error sending message";
        console.error(err);
      }
    });
  }

  loadMessagesList();
}

// ===============================
// LOAD MESSAGES LIST
// ===============================

async function loadMessagesList() {
  if (!messagesList) return;

  const user = getCurrentUser();
  if (!user) {
    messagesList.innerHTML = "Session expired";
    return;
  }

  messagesList.innerHTML = "Loading...";

  try {
    const q = query(
      collection(db, "messages"),
      where("to", "in", ["all", user.displayName])
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      messagesList.innerHTML = "<div>No messages found</div>";
      return;
    }

    let html = "";

    snap.forEach((docSnap) => {
      const m = docSnap.data();

      html += `
        <div class="message-item">
          <div><strong>From:</strong> ${m.from}</div>
          <div><strong>To:</strong> ${m.to}</div>
          <div><strong>Message:</strong> ${m.text}</div>
          <div><strong>Date:</strong> ${formatDateTime(m.createdAt)}</div>
        </div>
      `;
    });

    messagesList.innerHTML = html;

  } catch (err) {
    messagesList.innerHTML = "Error loading messages";
    console.error(err);
  }
}
