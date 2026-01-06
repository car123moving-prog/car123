// ===============================
// Firebase v9 Configuration
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCREnC-6yJX4l1HpFVNNZgOvodBQkEri5g",
  authDomain: "car123-moving.firebaseapp.com",
  projectId: "car123-moving",
  storageBucket: "car123-moving.firebasestorage.app",
  messagingSenderId: "820235378242",
  appId: "1:820235378242:web:94e0907a41a395c8bb17db"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firestore DB
export const db = getFirestore(app);
