/* Manage teaching assistants (admin/instructor/manage_tas.html) */

// Filter the available-students list as the user types
function searchStudents() {
    const searchTerm = document.getElementById("TA_search").value.toLowerCase();
    const studentOptions = document.querySelectorAll(".available_students");

    studentOptions.forEach((option) => {
        const text = option.textContent.toLowerCase();
        option.style.display = text.includes(searchTerm) ? "block" : "none";
    });
}

async function addInstructor() {
    const studentList = document.getElementById("studentList");
    const selectedStudent = studentList.value;

    if (!selectedStudent) {
        showAlert("Please select a student to add as TA.", "error");
        return;
    }

    try {
        const result = await postJSON("/assignment/instructor/add_ta", {
            student_id: selectedStudent,
        });

        if (result.success) {
            showAlert("Teaching Assistant added successfully!", "success");
            // Move the student from students list to instructors list
            const selectedOption = studentList.querySelector(
                `option[value="${selectedStudent}"]`
            );
            if (selectedOption) {
                const instructorList = document.getElementById("instructorList");
                const newOption = document.createElement("option");
                newOption.value = selectedStudent;
                newOption.textContent = selectedOption.textContent;
                instructorList.appendChild(newOption);
                selectedOption.remove();
            }
        } else {
            showAlert("Error adding TA: " + result.message, "error");
        }
    } catch (error) {
        showAlert("Error adding TA: " + error.message, "error");
    }
}

async function removeInstructor() {
    const instructorList = document.getElementById("instructorList");
    const selectedInstructor = instructorList.value;

    if (!selectedInstructor) {
        showAlert("Please select an instructor/TA to remove.", "error");
        return;
    }

    if (!confirm("Are you sure you want to remove this Teaching Assistant?")) {
        return;
    }

    try {
        const result = await postJSON("/assignment/instructor/remove_ta", {
            instructor_id: selectedInstructor,
        });

        if (result.success) {
            showAlert("Teaching Assistant removed successfully!", "success");
            // Move the instructor back to students list
            const selectedOption = instructorList.querySelector(
                `option[value="${selectedInstructor}"]`
            );
            if (selectedOption) {
                const studentList = document.getElementById("studentList");
                const newOption = document.createElement("option");
                newOption.value = selectedInstructor;
                newOption.textContent = selectedOption.textContent;
                newOption.className = "available_students";
                studentList.appendChild(newOption);
                selectedOption.remove();

                sortSelectOptions(studentList);
            }
        } else {
            showAlert("Error removing TA: " + result.message, "error");
        }
    } catch (error) {
        showAlert("Error removing TA: " + error.message, "error");
    }
}

// Sort a select element's options alphabetically
function sortSelectOptions(selectElement) {
    const options = Array.from(selectElement.options);
    options.sort((a, b) => a.text.localeCompare(b.text));
    selectElement.innerHTML = "";
    options.forEach((option) => selectElement.appendChild(option));
}
