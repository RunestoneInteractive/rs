/* Choose a course (admin/auth/courses.html) */

function selectDirect(val) {
    // Clear all radio selections and use the typed value
    document
        .querySelectorAll('input[name="course_name"]')
        .forEach((r) => (r.checked = false));
    // Store in a hidden field — swap the name on submit
    document.getElementById("direct_course").dataset.value = val;
}

document.getElementById("coursesForm").addEventListener("submit", function (e) {
    const direct = document.getElementById("direct_course").value.trim();
    const selected = document.querySelector('input[name="course_name"]:checked');
    if (direct && !selected) {
        // inject a hidden input so the direct value is submitted
        const h = document.createElement("input");
        h.type = "hidden";
        h.name = "course_name";
        h.value = direct;
        this.appendChild(h);
    } else if (!selected && !direct) {
        e.preventDefault();
        alert("Please select a course or type a course name.");
    }
});

document.getElementById("bookFilter").addEventListener("input", function () {
    const filter = this.value.trim().toLowerCase();
    document.querySelectorAll("#bookList .book-entry").forEach(function (entry) {
        const title = entry.dataset.title || "";
        const authors = entry.dataset.authors || "";
        entry.style.display =
            title.includes(filter) || authors.includes(filter) ? "" : "none";
    });
});
