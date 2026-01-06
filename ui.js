// ===============================
// UI Controls (Accordions + Roles)
// ===============================

// Activate accordion behavior
export function setupAccordions() {
  const headers = document.querySelectorAll(".accordion-header");

  headers.forEach((header) => {
    header.addEventListener("click", () => {
      const body = header.nextElementSibling;

      // Toggle visibility
      if (body.style.display === "block") {
        body.style.display = "none";
      } else {
        body.style.display = "block";
      }
    });
  });
}

// Apply role-based visibility
export function applyRoleVisibility(role) {
  const sections = document.querySelectorAll(".accordion");

  sections.forEach((sec) => {
    const allowed = sec.getAttribute("data-role");

    if (!allowed) return;

    const roles = allowed.split(" ");

    if (roles.includes(role)) {
      sec.style.display = "block";
    } else {
      sec.style.display = "none";
    }
  });
}
