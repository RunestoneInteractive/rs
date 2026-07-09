/* Manage students (admin/instructor/manage_students.html) */

async function resetOnePassword() {
    const studentList = document.getElementById("studentList");
    const selectedStudents = Array.from(studentList.selectedOptions).map(
        (option) => option.value
    );

    if (selectedStudents.length === 0 || selectedStudents[0] === "None") {
        alert("Please select a student first.");
        return;
    }

    if (selectedStudents.length > 1) {
        alert("Please select only one student for password reset.");
        return;
    }

    const newPassword = prompt("Enter the new password for this student:");
    if (!newPassword) {
        alert("Password reset cancelled.");
        return;
    }

    if (confirm("Are you sure you want to reset the password for this student?")) {
        try {
            const data = await postJSON("/admin/instructor/reset_password", {
                sid: selectedStudents[0],
                password: newPassword,
            });
            if (data.success) {
                alert("Password reset successfully.");
            } else {
                alert("Error resetting password: " + data.message);
            }
        } catch (error) {
            alert("Error resetting password: " + error.message);
        }
    }
}
