/* Copy assignments (admin/instructor/copy_assignments.html) */

// Populate the assignment dropdown when a source course is selected
function getAssignList(sel) {
    const data = { course_name: sel.value };
    $("#assignSelection").empty(); // Clear the entire container
    $("#copyButton").prop("disabled", true);

    if (!sel.value) {
        return;
    }

    $.getJSON("/admin/instructor/source_assignments", data, function (data) {
        let container = document.getElementById("assignSelection");

        let label = document.createElement("label");
        label.textContent = "Select assignment to copy:";
        label.setAttribute("for", "assignmentsDropdown");
        container.appendChild(label);

        let sel = document.createElement("select");
        sel.classList.add("form-control");
        sel.id = "assignmentsDropdown";
        sel.onchange = function () {
            $("#copyButton").prop("disabled", false);
        };

        // Add "All" option, selected by default
        let opt = document.createElement("option");
        opt.value = -1;
        opt.text = "All Assignments";
        opt.selected = true;
        sel.appendChild(opt);

        for (let assign of data.assignments) {
            let opt = document.createElement("option");
            opt.value = assign.id;
            opt.text = assign.name;
            sel.appendChild(opt);
        }

        container.appendChild(sel);

        // Enable the copy button since "All Assignments" is selected by default
        $("#copyButton").prop("disabled", false);
    }).fail(function () {
        showMessage("Failed to load assignments for selected course", "error");
    });
}

async function copyAssignments() {
    let selectedCourse = document.getElementById("courseSelection").value;
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

// Show a dismissable Bootstrap alert in the floating message container
function showMessage(message, type) {
    const alertClass = type === "success" ? "alert-success" : "alert-danger";
    const icon =
        type === "success" ? "fas fa-check-circle" : "fas fa-exclamation-circle";

    const messageHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            <i class="${icon}"></i> ${message}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    `;

    $("#messageContainer").html(messageHtml);

    // Auto-dismiss after 5 seconds
    setTimeout(function () {
        $("#messageContainer .alert").alert("close");
    }, 5000);
}
