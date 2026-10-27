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

        if (d.detailData && d.detailData.length > 0) {
            renderReportTable(document.getElementById("detail-container"), d.detailData, {
                caption: "Question detail",
                cellClass: scoreClass,
            });
        } else {
            document.getElementById("detail-container").innerHTML =
                '<p class="no-data">No data recorded for this student on this assignment.</p>';
        }
    });

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
