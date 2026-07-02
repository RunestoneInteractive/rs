/* Delete course (admin/instructor/course_delete.html)
   Expects window.COURSE_DELETE_DATA = { courseName } set by the template. */

function validateConfirmation() {
    const input = document.getElementById("courseNameConfirm");
    const deleteBtn = document.getElementById("deleteBtn");

    deleteBtn.disabled = input.value !== window.COURSE_DELETE_DATA.courseName;
}

async function performDelete() {
    const courseName = window.COURSE_DELETE_DATA.courseName;

    const finalConfirm = confirm(
        `FINAL CONFIRMATION:\n\n` +
            `You are about to PERMANENTLY DELETE the course "${courseName}".\n\n` +
            `This will:\n` +
            `• Remove ALL student access\n` +
            `• Delete ALL assignments and grades\n` +
            `• Erase ALL course data\n\n` +
            `This action CANNOT be undone.\n\n` +
            `Are you absolutely certain you want to proceed?`
    );

    if (!finalConfirm) {
        return;
    }

    // Disable the button and show loading state
    const deleteBtn = document.getElementById("deleteBtn");
    const originalText = deleteBtn.textContent;
    deleteBtn.disabled = true;
    deleteBtn.textContent = "DELETING COURSE...";

    try {
        const data = await postJSON("/admin/instructor/delete_course", {
            course_name: courseName,
            confirmed: true,
        });
        if (data.success) {
            alert(`Course "${courseName}" has been permanently deleted.`);
            // Redirect to a safe page since this course no longer exists
            window.location.href = "/";
        } else {
            alert(`Error deleting course: ${data.message}`);
            deleteBtn.textContent = originalText;
            validateConfirmation(); // Re-enable if confirmation is still valid
        }
    } catch (error) {
        alert(`Error deleting course: ${error.message}`);
        deleteBtn.textContent = originalText;
        validateConfirmation(); // Re-enable if confirmation is still valid
    }
}

// Initialize the confirmation state
document.addEventListener("DOMContentLoaded", validateConfirmation);
