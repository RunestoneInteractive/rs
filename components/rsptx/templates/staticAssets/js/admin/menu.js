/* Instructor dashboard (admin/instructor/menu.html) */

function toggleAccordion(header) {
    const content = header.nextElementSibling;

    header.classList.toggle("active");
    content.classList.toggle("active");

    updateToggleAllButton();
}

function toggleAllAccordions() {
    const btn = document.getElementById("toggleAllBtn");
    const allHeaders = document.querySelectorAll(".accordion-header");
    const allContents = document.querySelectorAll(".accordion-content");

    const anyOpen = Array.from(allHeaders).some((h) =>
        h.classList.contains("active")
    );

    if (anyOpen) {
        allHeaders.forEach((h) => h.classList.remove("active"));
        allContents.forEach((c) => c.classList.remove("active"));
        btn.textContent = "Show All Sections";
    } else {
        allHeaders.forEach((h) => h.classList.add("active"));
        allContents.forEach((c) => c.classList.add("active"));
        btn.textContent = "Hide All Sections";
    }
}

function updateToggleAllButton() {
    const btn = document.getElementById("toggleAllBtn");
    const allHeaders = document.querySelectorAll(".accordion-header");
    const anyOpen = Array.from(allHeaders).some((h) =>
        h.classList.contains("active")
    );

    btn.textContent = anyOpen ? "Hide All Sections" : "Show All Sections";
}

// Placeholder handlers for features that need implementation
function showExerciseMetrics() {
    alert("Exercise metrics feature coming soon!");
}

function showLTISetup() {
    alert("LTI setup panel coming soon!");
}

// Open first accordion by default
document.addEventListener("DOMContentLoaded", function () {
    const firstAccordion = document.querySelector(".accordion-header");
    if (firstAccordion) {
        toggleAccordion(firstAccordion);
    }
    updateToggleAllButton();
});
