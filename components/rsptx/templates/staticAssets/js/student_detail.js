/**
 * student_detail.js — Student drilldown page logic
 *
 * Data is pre-loaded into window.STUDENT_DATA by the template, so no
 * AJAX calls are needed. We just render two tables on page load.
 */

(function () {
    "use strict";

    // -------------------------------------------------------------------------
    // Render on DOM ready
    // -------------------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", function () {
        var d = window.STUDENT_DATA;
        if (!d) return;

        if (d.summaryData && d.summaryData.length > 0) {
            renderReportTable(document.getElementById("summary-container"), d.summaryData, {
                caption: "Subchapter summary",
            });
        } else {
            document.getElementById("summary-container").innerHTML =
                '<p class="no-data">No activity recorded for this student.</p>';
        }

        if (d.detailData && d.detailData.length > 0) {
            renderReportTable(document.getElementById("detail-container"), d.detailData, {
                caption: "Exercise detail",
                cellClass: correctClass,
            });
        } else {
            document.getElementById("detail-container").innerHTML =
                '<p class="no-data">No exercise activity recorded for this student.</p>';
        }
    });

    // Colours "Yes"/"No" cells in the "Correct" column green/red.
    function correctClass(colKey, value) {
        if (colKey !== "Correct") return null;
        if (value === "Yes") return "score-good";
        if (value === "No") return "score-bad";
        return null;
    }

    // -------------------------------------------------------------------------
    // CSV download
    // -------------------------------------------------------------------------
    window.downloadCSV = function (which) {
        var d = window.STUDENT_DATA;
        var data = which === "summary" ? d.summaryData : d.detailData;
        if (!data || data.length === 0) return;

        var filename =
            which + "_" + d.studentName + "_" + d.courseName + ".csv";

        var blob = new Blob([reportTableCSV(data)], { type: "text/csv" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
})();
