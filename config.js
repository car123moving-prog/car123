// ===============================
// Firebase v9 Configuration
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// ضع إعدادات مشروعك هنا
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firestore DB
export const db = getFirestore(app);
