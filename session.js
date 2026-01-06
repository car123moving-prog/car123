// ===============================
// Session Management
// ===============================

// Save user session
export function saveSession(user) {
  localStorage.setItem("carUser", JSON.stringify(user));
}

// Get current user
export function getCurrentUser() {
  const data = localStorage.getItem("carUser");
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Clear session
export function clearSession() {
  localStorage.removeItem("carUser");
}
