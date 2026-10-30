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
    // Student answers
    // -------------------------------------------------------------------------
    // Each question waits in a <template> until the book's components have
    // auto-rendered the page, so none of them render it as the instructor.  It
    // is then rendered in grader mode with the student's sid: the component
    // fetches and shows that student's latest answer, and logs nothing.
    //
    // With the deadline switch on, each component is also given the student's
    // deadline, and shows the last answer made before it instead.
    document.addEventListener("runestone:login-complete", function () {
        // Let the components' own login-complete listeners run first.
        setTimeout(function () {
            var toggle = document.getElementById("before-deadline-switch");
            if (toggle) {
                toggle.addEventListener("change", function () {
                    renderStudentAnswers(toggle.checked);
                });
            }
            renderStudentAnswers(false);
        }, 0);
    });

    function renderStudentAnswers(beforeDeadline) {
        var d = window.ASSIGNMENT_STUDENT_DATA;
        var container = document.getElementById("student-answers");
        if (!container) return;
        container.classList.toggle("before-deadline", beforeDeadline);
        var deadline = beforeDeadline && d.deadline ? new Date(d.deadline) : null;
        container.querySelectorAll("template.answer-src").forEach(function (tpl) {
            // Start over from the stored source: a rendered component cannot
            // be told to reload a different answer.
            var host = tpl.nextElementSibling;
            host.replaceChildren(tpl.content.cloneNode(true));
            renderAnswer(host, d.sid, deadline);
        });
    }

    async function renderAnswer(host, sid, deadline) {
        var orig = host.querySelector("[data-component]");
        // Without a data-component (older WeBWorK markup) there is nothing to
        // restore an answer into; leave the question text as it is.
        if (!orig) return;
        var kind = orig.dataset.component;
        try {
            await window.runestoneComponents.runestone_import(kind);
        } catch (e) {
            // Iframe-hosted kinds (splice, doenet, khanex) have no module;
            // their markup is already the whole question.
            return;
        }
        try {
            var langEl = orig.dataset.lang ? orig : orig.querySelector("[data-lang]");
            var opts = {
                orig: orig,
                lang: langEl ? langEl.dataset.lang : undefined,
                useRunestoneServices: true,
                graderactive: true,
                sid: sid,
                python3: true,
            };
            if (deadline) {
                // Sent to the server, which returns the last answer before it;
                // activecode moves its history scrubber to the deadline too.
                opts.enforceDeadline = true;
                opts.deadline = deadline;
            }
            var component = window.component_factory[kind](opts);
            window.componentMap[orig.id] = component;
        } catch (e) {
            console.error("Could not render " + kind + " " + orig.id, e);
            var msg = document.createElement("p");
            msg.className = "no-data";
            msg.textContent = "This " + kind + " question could not be rendered.";
            host.appendChild(msg);
        }
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
