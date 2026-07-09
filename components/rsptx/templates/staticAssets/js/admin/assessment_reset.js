/* Reset student assessment (admin/instructor/assessment_reset.html) */

function updateResetButton() {
    const studentSelect = document.getElementById("studentSelect");
    const assessmentSelect = document.getElementById("assessmentSelect");
    const resetBtn = document.getElementById("resetBtn");

    const studentSelected = studentSelect.value !== "";
    const assessmentSelected = assessmentSelect.value !== "";

    resetBtn.disabled = !(studentSelected && assessmentSelected);
}

async function performReset() {
    const studentSelect = document.getElementById("studentSelect");
    const assessmentSelect = document.getElementById("assessmentSelect");

    const studentId = studentSelect.value;
    const assessmentName = assessmentSelect.value;

    if (!studentId || !assessmentName) {
        alert("Please select both a student and an assessment.");
        return;
    }

    const studentName = studentSelect.options[studentSelect.selectedIndex].text;
    const assessmentDisplayName =
        assessmentSelect.options[assessmentSelect.selectedIndex].text;

    const confirmMessage = `Are you sure you want to reset "${assessmentDisplayName}" for student "${studentName}"?\n\nThis will permanently delete all their progress and answers for this assessment. This action cannot be undone.`;

    if (!confirm(confirmMessage)) {
        return;
    }

    // Disable the button during the reset operation
    const resetBtn = document.getElementById("resetBtn");
    const originalText = resetBtn.textContent;
    resetBtn.disabled = true;
    resetBtn.textContent = "Resetting...";

    try {
        const data = await postJSON("/admin/instructor/reset_assessment", {
            student_username: studentId,
            assessment_name: assessmentName,
        });
        if (data.success) {
            alert(
                `Successfully reset "${assessmentDisplayName}" for student "${studentName}".`
            );
            // Clear the selections
            studentSelect.value = "";
            assessmentSelect.value = "";
        } else {
            alert(`Error resetting assessment: ${data.message}`);
        }
    } catch (error) {
        alert(`Error resetting assessment: ${error.message}`);
    } finally {
        resetBtn.textContent = originalText;
        updateResetButton();
    }
}

// Update the reset button state when either selection changes
document
    .getElementById("studentSelect")
    .addEventListener("change", updateResetButton);
document
    .getElementById("assessmentSelect")
    .addEventListener("change", updateResetButton);

// Initialize the button state
document.addEventListener("DOMContentLoaded", updateResetButton);
