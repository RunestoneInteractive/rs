/* Manage instructors/TAs (admin/instructor/add_instructor.html) */

let selectedInstructorId = null;
let selectedStudentId = null;
let allStudents = [];

async function loadInstructors() {
    const res = await fetch("/admin/instructor/current_instructors");
    const data = await res.json();
    const list = document.getElementById("instructor-list");
    list.innerHTML = "";
    data.instructors.forEach((inst) => {
        const li = document.createElement("li");
        li.textContent = `${inst.first_name} ${inst.last_name} (${inst.username})`;
        li.dataset.id = inst.id;
        li.onclick = function () {
            document
                .querySelectorAll("#instructor-list li")
                .forEach((el) => el.classList.remove("selected"));
            li.classList.add("selected");
            selectedInstructorId = inst.id;
            document.getElementById("remove-instructor-btn").disabled = false;
        };
        list.appendChild(li);
    });
    document.getElementById("remove-instructor-btn").disabled = true;
    selectedInstructorId = null;
}

async function loadStudents() {
    const res = await fetch("/admin/instructor/available_students");
    const data = await res.json();
    allStudents = data.students;
    renderStudentList("");
}

function renderStudentList(filter) {
    const select = document.getElementById("student-list");
    select.innerHTML = "";
    allStudents
        .filter((s) => {
            const name = `${s.first_name} ${s.last_name} ${s.username}`.toLowerCase();
            return name.includes(filter.toLowerCase());
        })
        .forEach((s) => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = `${s.first_name} ${s.last_name} (${s.username})`;
            select.appendChild(opt);
        });
    document.getElementById("add-instructor-btn").disabled = true;
    selectedStudentId = null;
}

document.getElementById("student-search").addEventListener("input", function () {
    renderStudentList(this.value);
});

document.getElementById("student-list").addEventListener("change", function () {
    selectedStudentId = this.value;
    document.getElementById("add-instructor-btn").disabled = !selectedStudentId;
});

document.getElementById("add-instructor-btn").onclick = async function () {
    if (!selectedStudentId) return;
    const data = await postJSON("/admin/instructor/add_instructor_user", {
        user_id: selectedStudentId,
    });
    if (data.success) {
        await loadInstructors();
        await loadStudents();
    } else {
        alert(data.message || "Failed to add instructor");
    }
};

document.getElementById("remove-instructor-btn").onclick = async function () {
    if (!selectedInstructorId) return;
    const data = await postJSON("/admin/instructor/remove_ta", {
        instructor_id: selectedInstructorId,
    });
    if (data.success) {
        await loadInstructors();
        await loadStudents();
    } else {
        alert(data.message || "Failed to remove instructor");
    }
};

// Initial load
loadInstructors();
loadStudents();
