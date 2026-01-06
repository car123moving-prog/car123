// ===============================
// Utility Functions
// ===============================

// Format timestamp to readable date/time
export function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const date = d.toLocaleDateString("en-GB");
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

// Shorten long text
export function shorten(text, max = 25) {
  if (!text) return "";
  return text.length > max ? text.substring(0, max) + "..." : text;
}

// Generate random ID
export function randomId() {
  return Math.random().toString(36).substring(2, 10);
}
