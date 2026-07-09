/* Copy assignments (admin/instructor/copy_assignments.html) */

// Populate the assignment dropdown when a source course is selected
async function getAssignList(sel) {
    const container = document.getElementById("assignSelection");
    const copyButton = document.getElementById("copyButton");
    container.innerHTML = ""; // Clear the entire container
    copyButton.disabled = true;

    if (!sel.value) {
        return;
    }

    let data;
    try {
        const params = new URLSearchParams({ course_name: sel.value });
        const response = await fetch(
            `/admin/instructor/source_assignments?${params}`
        );
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        data = await response.json();
    } catch (error) {
        showMessage("Failed to load assignments for selected course", "error");
        return;
    }

    const label = document.createElement("label");
    label.textContent = "Select assignment to copy:";
    label.setAttribute("for", "assignmentsDropdown");
    container.appendChild(label);

    const dropdown = document.createElement("select");
    dropdown.classList.add("form-control");
    dropdown.id = "assignmentsDropdown";
    dropdown.onchange = function () {
        copyButton.disabled = false;
    };

    // Add "All" option, selected by default
    const allOpt = document.createElement("option");
    allOpt.value = -1;
    allOpt.text = "All Assignments";
    allOpt.selected = true;
    dropdown.appendChild(allOpt);

    for (const assign of data.assignments) {
        const opt = document.createElement("option");
        opt.value = assign.id;
        opt.text = assign.name;
        dropdown.appendChild(opt);
    }

    container.appendChild(dropdown);

    // Enable the copy button since "All Assignments" is selected by default
    copyButton.disabled = false;
}

async function copyAssignments() {
    const selectedCourse = document.getElementById("courseSelection").value;
    let selectedAssignment = document.getElementById("assignmentsDropdown");

    if (!selectedCourse || !selectedAssignment) {
        showMessage("Please select both a course and an assignment", "error");
        return;
    }

    selectedAssignment =
        selectedAssignment.options[selectedAssignment.selectedIndex].value;

    // Show loading state
    const copyButton = document.getElementById("copyButton");
    copyButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Copying...';
    copyButton.disabled = true;

    try {
        const data = await postJSON("/admin/instructor/copy_assignment", {
            oldassignment: selectedAssignment,
            course: selectedCourse,
        });
        if (data.success) {
            showMessage("Assignment(s) copied successfully!", "success");
            // Reset form
            document.getElementById("courseSelection").value = "";
            document.getElementById("assignSelection").innerHTML = "";
        } else {
            showMessage(`Copy Failed: ${data.message}`, "error");
        }
    } catch (error) {
        showMessage("Copy failed due to server error", "error");
    } finally {
        copyButton.innerHTML = '<i class="fas fa-copy"></i> Copy Assignment';
        copyButton.disabled = true;
    }
}

// Show a dismissable alert in the floating message container
function showMessage(message, type) {
    const alertClass = type === "success" ? "alert-success" : "alert-danger";
    const icon =
        type === "success" ? "fas fa-check-circle" : "fas fa-exclamation-circle";

    const container = document.getElementById("messageContainer");
    container.innerHTML = `
        <div class="alert ${alertClass} alert-dismissible" role="alert">
            <i class="${icon}"></i> ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `;

    // Auto-dismiss after 5 seconds
    setTimeout(function () {
        container.innerHTML = "";
    }, 5000);
}
