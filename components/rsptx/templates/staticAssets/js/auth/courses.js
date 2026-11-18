/* Choose a course (admin/auth/courses.html) */

const directInput = document.getElementById("direct_course");
const winsNote = document.getElementById("direct_wins_note");

function selectedRadio() {
    return document.querySelector('input[name="course_name"]:checked');
}

/* A typed course name wins over any book or institution course the student also
   clicked -- the server applies the same rule, this only makes it visible. See
   issue #1489: picking the book a course is based on used to enroll the student
   in the open base course, where their work counted for nothing. */
function showWhichWins() {
    if (winsNote) {
        winsNote.hidden = !(directInput.value.trim() && selectedRadio());
    }
}

function selectDirect(val) {
    // Typing supersedes an earlier pick, so drop it rather than leaving two
    // conflicting answers on screen.
    if (val.trim()) {
        document
            .querySelectorAll('input[name="course_name"]')
            .forEach((r) => (r.checked = false));
    }
    showWhichWins();
}

document.querySelectorAll('input[name="course_name"]').forEach((radio) => {
    radio.addEventListener("change", showWhichWins);
});

document.getElementById("coursesForm").addEventListener("submit", function (e) {
    if (!directInput.value.trim() && !selectedRadio()) {
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

showWhichWins();
