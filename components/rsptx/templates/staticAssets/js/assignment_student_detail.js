/**
 * assignment_student_detail.js — Assignment student drilldown page
 *
 * Data is pre-loaded into window.ASSIGNMENT_STUDENT_DATA by the template.
 * Renders a single Handsontable with per-question detail for one student.
 */

(function () {
    "use strict";

    var detailHot = null;

    document.addEventListener("DOMContentLoaded", function () {
        var d = window.ASSIGNMENT_STUDENT_DATA;
        if (!d) return;

        if (d.detailData && d.detailData.length > 0) {
            detailHot = renderTable("detail-container", d.detailData);
        } else {
            document.getElementById("detail-container").innerHTML =
                '<p class="no-data">No data recorded for this student on this assignment.</p>';
        }
    });

    // -------------------------------------------------------------------------
    // Table rendering
    // -------------------------------------------------------------------------
    function renderTable(containerId, data) {
        var container = document.getElementById(containerId);
        var keys = Object.keys(data[0]);

        var columns = keys.map(function (k) {
            return { data: k, renderer: scoreRenderer(k) };
        });

        var colHeaders = keys.map(function (k) {
            return "<b>" + escapeHtml(k) + "</b>";
        });

        return new Handsontable(container, {
            data: data,
            columns: columns,
            colHeaders: colHeaders,
            licenseKey: "non-commercial-and-evaluation",
            fixedColumnsLeft: 1,
            readOnly: true,
            stretchH: "none",
            width: "100%",
            height: Math.min(560, data.length * 24 + 60),
            rowHeaders: false,
            afterGetColHeader: function (col, TH) {
                TH.innerHTML = this.getSettings().colHeaders[col];
            },
        });
    }

    // Colour the Score column: green if > 0, red if 0 (but not blank)
    function scoreRenderer(colKey) {
        return function (hotInstance, TD, row, col, prop, value) {
            Handsontable.renderers.HtmlRenderer.apply(this, arguments);
            if (colKey === "Score") {
                TD.style.color = "";
                TD.style.fontWeight = "";
                if (value !== null && value !== "" && value !== undefined) {
                    if (parseFloat(value) > 0) {
                        TD.style.color = "#2e7d32";
                        TD.style.fontWeight = "600";
                    } else {
                        TD.style.color = "#c62828";
                    }
                }
            }
        };
    }

    // -------------------------------------------------------------------------
    // CSV download
    // -------------------------------------------------------------------------
    window.downloadCSV = function () {
        if (!detailHot) return;

        var data    = detailHot.getData();
        var headers = detailHot.getColHeader();
        var cleanHeaders = headers.map(function (h) {
            return h.replace(/<[^>]*>/g, "");
        });

        var rows = [cleanHeaders].concat(data);
        var csv  = rows.map(function (row) {
            return row.map(function (cell) {
                var s = cell == null ? "" : String(cell);
                if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }).join(",");
        }).join("\n");

        var d        = window.ASSIGNMENT_STUDENT_DATA;
        var filename = "assignment_" + d.assignmentName + "_" + d.studentName + ".csv";

        var blob = new Blob([csv], { type: "text/csv" });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement("a");
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
})();
