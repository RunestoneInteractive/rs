/**
 * assignment_student_detail.js — Assignment student drilldown page
 *
 * Data is pre-loaded into window.ASSIGNMENT_STUDENT_DATA by the template.
 * Renders a single table with per-question detail for one student.
 */

(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        var d = window.ASSIGNMENT_STUDENT_DATA;
        if (!d) return;

        renderDetailTable();
        document.querySelectorAll("#student-answers .edit-grade").forEach(function (btn) {
            btn.addEventListener("click", function () {
                editGrade(btn);
            });
        });
    });

    function renderDetailTable() {
        var d = window.ASSIGNMENT_STUDENT_DATA;
        var container = document.getElementById("detail-container");
        if (d.detailData && d.detailData.length > 0) {
            renderReportTable(container, d.detailData, {
                caption: "Question detail",
                cellClass: scoreClass,
            });
        } else {
            container.innerHTML =
                '<p class="no-data">No data recorded for this student on this assignment.</p>';
        }
    }

    // -------------------------------------------------------------------------
    // Grade editing
    // -------------------------------------------------------------------------
    async function editGrade(btn) {
        var d = window.ASSIGNMENT_STUDENT_DATA;
        var card = btn.closest(".student-answer");
        var divId = btn.dataset.divId;
        var saved = await window.RSGradeDialog.open({
            sid: d.sid,
            divId: divId,
            assignmentId: d.assignmentId,
            score: btn.dataset.score,
            maxPoints: btn.dataset.points === "" ? null : btn.dataset.points,
            comment: btn.dataset.comment,
            title: "Edit grade: " + divId,
            subtitle: d.studentFullName + " — " + d.assignmentName,
        });
        btn.focus();
        if (!saved) return;

        btn.dataset.score = saved.score;
        btn.dataset.comment = saved.comment;
        card.querySelector(".question-score").textContent = saved.score;
        d.detailData.forEach(function (row) {
            if (row.Question === divId) row.Score = saved.score;
        });
        renderDetailTable();
        var total = saved.totals && saved.totals[d.assignmentId];
        if (total != null) {
            document.getElementById("total-score").textContent =
                Math.round(total * 100) / 100;
        }
    }

    // -------------------------------------------------------------------------
    // Student answers (rendered by student_answers.js)
    // -------------------------------------------------------------------------
    // With the deadline switch on, each component is also given the student's
    // deadline, and shows the last answer made before it instead.
    RSStudentAnswers.whenReady(function () {
        var toggle = document.getElementById("before-deadline-switch");
        if (toggle) {
            toggle.addEventListener("change", function () {
                renderStudentAnswers(toggle.checked);
            });
        }
        renderStudentAnswers(false);
    });

    function renderStudentAnswers(beforeDeadline) {
        var d = window.ASSIGNMENT_STUDENT_DATA;
        var container = document.getElementById("student-answers");
        if (!container) return;
        container.classList.toggle("before-deadline", beforeDeadline);
        var deadline = beforeDeadline && d.deadline ? new Date(d.deadline) : null;
        container.querySelectorAll("template.answer-src").forEach(function (tpl) {
            RSStudentAnswers.render(tpl, { sid: d.sid, deadline: deadline });
        });
    }

    // Colour the Score column: green if > 0, red if 0 (but not blank)
    function scoreClass(colKey, value) {
        if (colKey !== "Score") return null;
        if (value === null || value === "" || value === undefined) return null;
        return parseFloat(value) > 0 ? "score-good" : "score-bad";
    }

    // -------------------------------------------------------------------------
    // CSV download
    // -------------------------------------------------------------------------
    window.downloadCSV = function () {
        var d = window.ASSIGNMENT_STUDENT_DATA;
        if (!d.detailData || d.detailData.length === 0) return;

        var filename = "assignment_" + d.assignmentName + "_" + d.studentName + ".csv";

        var blob = new Blob([reportTableCSV(d.detailData)], { type: "text/csv" });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement("a");
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
})();
