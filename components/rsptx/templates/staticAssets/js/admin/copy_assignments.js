/* Copy assignments (admin/instructor/copy_assignments.html)
 *
 * Two steps: pick a source course, then pick one assignment or all of them.
 * The course list is fetched rather than rendered into a <select> because it
 * now spans every course that shares something, not just the instructor's own.
 */

const SEARCH_DEBOUNCE_MS = 300;

let selectedCourse = null;
let searchTimer = null;

function debounce(fn, ms) {
    return function (...args) {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => fn(...args), ms);
    };
}

function badge(text, kind) {
    const span = document.createElement("span");
    span.className = `badge badge-${kind} course-badge`;
    span.textContent = text;
    return span;
}

// --- Step 1: courses -------------------------------------------------------

async function loadCourses() {
    const results = document.getElementById("courseResults");
    const params = new URLSearchParams({
        search: document.getElementById("courseSearch").value,
        use_base_course: document.getElementById("useBaseCourse").checked,
        only_my_courses: document.getElementById("onlyMyCourses").checked,
        limit: 25,
    });

    results.setAttribute("aria-busy", "true");

    let data;
    try {
        const response = await fetch(`/admin/instructor/shareable_courses?${params}`);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        data = await response.json();
    } catch (error) {
        results.removeAttribute("aria-busy");
        showMessage("Could not load the list of courses", "error");
        return;
    }

    results.removeAttribute("aria-busy");
    results.innerHTML = "";

    if (!data.courses.length) {
        const empty = document.createElement("p");
        empty.className = "text-muted";
        empty.textContent = "No courses match that search.";
        results.appendChild(empty);
        return;
    }

    for (const course of data.courses) {
        results.appendChild(courseRow(course));
    }
}

function courseRow(course) {
    // A real button so the list is reachable from the keyboard; the rows are a
    // listbox, not a set of links.
    const row = document.createElement("button");
    row.type = "button";
    row.className = "course-row";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", "false");
    row.onclick = () => selectCourse(course, row);

    const title = document.createElement("span");
    title.className = "course-row-title";
    title.textContent = course.course_name;
    row.appendChild(title);

    if (course.is_official) {
        row.appendChild(badge("Official", "primary"));
    }
    if (course.is_mine) {
        row.appendChild(badge("Yours", "secondary"));
    }

    const meta = document.createElement("span");
    meta.className = "course-row-meta";
    const where = course.is_official
        ? course.book_title
        : [course.institution, course.book_title].filter(Boolean).join(" · ");
    const count = course.shareable_count;
    meta.textContent = `${where} — ${count} assignment${count === 1 ? "" : "s"}`;
    row.appendChild(meta);

    return row;
}

function selectCourse(course, row) {
    selectedCourse = course;

    for (const other of document.querySelectorAll(".course-row")) {
        other.classList.toggle("selected", other === row);
        other.setAttribute("aria-selected", String(other === row));
    }

    loadAssignments(course);
}

// --- Step 2: assignments ---------------------------------------------------

async function loadAssignments(course) {
    const card = document.getElementById("assignmentCard");
    const container = document.getElementById("assignSelection");
    const copyButton = document.getElementById("copyButton");

    card.hidden = false;
    container.innerHTML = "";
    copyButton.disabled = true;

    let data;
    try {
        const params = new URLSearchParams({ course_name: course.course_name });
        const response = await fetch(`/admin/instructor/source_assignments?${params}`);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        data = await response.json();
    } catch (error) {
        showMessage("Failed to load assignments for that course", "error");
        return;
    }

    if (!data.assignments.length) {
        const empty = document.createElement("p");
        empty.className = "text-muted";
        empty.textContent = "That course has nothing you can copy.";
        container.appendChild(empty);
        return;
    }

    const label = document.createElement("label");
    label.textContent = "Select what to copy:";
    label.setAttribute("for", "assignmentsDropdown");
    container.appendChild(label);

    const dropdown = document.createElement("select");
    dropdown.classList.add("form-control");
    dropdown.id = "assignmentsDropdown";

    // Bulk is the common case and the reason to use this page rather than the
    // assignment browser, so it leads and is selected by default.
    const newCount = data.assignments.filter((a) => !a.already_imported).length;
    const allOpt = document.createElement("option");

    allOpt.value = "";
    allOpt.text =
        newCount === data.assignments.length
            ? `All assignments (${newCount})`
            : `All assignments (${newCount} new, ${
                  data.assignments.length - newCount
              } already copied)`;
    allOpt.selected = true;
    dropdown.appendChild(allOpt);

    for (const assign of data.assignments) {
        const opt = document.createElement("option");
        opt.value = assign.id;
        opt.text = assign.already_imported
            ? `${assign.name} — already copied as "${assign.imported_as}"`
            : assign.name;
        dropdown.appendChild(opt);
    }

    container.appendChild(dropdown);

    if (data.truncated) {
        const note = document.createElement("small");
        note.className = "form-text text-muted";
        note.textContent =
            "This course has more assignments than are listed. \"All assignments\" still copies every one of them.";
        container.appendChild(note);
    }

    copyButton.disabled = false;
}

async function copyAssignments() {
    const dropdown = document.getElementById("assignmentsDropdown");

    if (!selectedCourse || !dropdown) {
        showMessage("Pick a course and an assignment first", "error");
        return;
    }

    const chosen = dropdown.options[dropdown.selectedIndex].value;
    const copyButton = document.getElementById("copyButton");

    copyButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Copying...';
    copyButton.disabled = true;

    try {
        const data = await postJSON("/admin/instructor/copy_assignment", {
            source_course_id: selectedCourse.id,
            // "" is the All option; the endpoint reads a missing id as "all".
            assignment_id: chosen === "" ? null : Number(chosen),
        });
        if (data.success) {
            showMessage(data.message, "success");
            // Reload the list so what just came across shows as already copied
            // rather than inviting a second pass.
            await loadAssignments(selectedCourse);
        } else {
            showMessage(`Copy failed: ${data.message}`, "error");
        }
    } catch (error) {
        showMessage("Copy failed due to server error", "error");
    } finally {
        copyButton.innerHTML = '<i class="fas fa-copy"></i> Copy';
        copyButton.disabled = false;
    }
}

// Show a dismissable alert in the floating message container
function showMessage(message, type) {
    const alertClass = type === "success" ? "alert-success" : "alert-danger";
    const icon =
        type === "success" ? "fas fa-check-circle" : "fas fa-exclamation-circle";

    const container = document.getElementById("messageContainer");
    const alert = document.createElement("div");

    alert.className = `alert ${alertClass} alert-dismissible`;
    alert.setAttribute("role", "alert");

    const iconEl = document.createElement("i");
    iconEl.className = icon;
    alert.appendChild(iconEl);
    // Text node rather than innerHTML: the message carries assignment names
    // that came from another instructor's course.
    alert.appendChild(document.createTextNode(` ${message}`));

    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("data-dismiss", "alert");
    close.setAttribute("aria-label", "Close");
    close.innerHTML = '<span aria-hidden="true">&times;</span>';
    alert.appendChild(close);

    container.innerHTML = "";
    container.appendChild(alert);

    setTimeout(function () {
        container.innerHTML = "";
    }, 8000);
}

document.addEventListener("DOMContentLoaded", function () {
    document
        .getElementById("courseSearch")
        .addEventListener("input", debounce(loadCourses, SEARCH_DEBOUNCE_MS));
    document
        .getElementById("useBaseCourse")
        .addEventListener("change", loadCourses);
    document
        .getElementById("onlyMyCourses")
        .addEventListener("change", loadCourses);
    loadCourses();
});
