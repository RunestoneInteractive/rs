/**
 * student_detail.js — Student drilldown page logic
 *
 * Data is pre-loaded into window.STUDENT_DATA by the template, so no
 * AJAX calls are needed. We just render two Handsontable instances on
 * page load.
 */

(function () {
    "use strict";

    var summaryHot = null;
    var detailHot = null;

    // -------------------------------------------------------------------------
    // Render on DOM ready
    // -------------------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", function () {
        var d = window.STUDENT_DATA;
        if (!d) return;

        if (d.summaryData && d.summaryData.length > 0) {
            summaryHot = renderTable("summary-container", d.summaryData);
        } else {
            document.getElementById("summary-container").innerHTML =
                '<p class="no-data">No activity recorded for this student.</p>';
        }

        if (d.detailData && d.detailData.length > 0) {
            detailHot = renderTable("detail-container", d.detailData, {
                colorCorrect: true,
            });
        } else {
            document.getElementById("detail-container").innerHTML =
                '<p class="no-data">No exercise activity recorded for this student.</p>';
        }
    });

    // -------------------------------------------------------------------------
    // Table rendering
    // -------------------------------------------------------------------------
    function renderTable(containerId, data, opts) {
        opts = opts || {};
        var container = document.getElementById(containerId);
        var keys = Object.keys(data[0]);

        var columns = keys.map(function (k) {
            return { data: k, renderer: opts.colorCorrect ? colorRenderer(k) : "html" };
        });

        var colHeaders = keys.map(function (k) {
            return "<b>" + escapeHtml(k) + "</b>";
        });

        var hot = new Handsontable(container, {
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

        return hot;
    }

    // Renderer factory: colours "Yes"/"No" cells in the "Correct" column green/red.
    function colorRenderer(colKey) {
        return function (hotInstance, TD, row, col, prop, value) {
            Handsontable.renderers.HtmlRenderer.apply(this, arguments);
            if (colKey === "Correct") {
                TD.style.color = "";
                TD.style.fontWeight = "";
                if (value === "Yes") {
                    TD.style.color = "#2e7d32";
                    TD.style.fontWeight = "600";
                } else if (value === "No") {
                    TD.style.color = "#c62828";
                }
            }
        };
    }

    // -------------------------------------------------------------------------
    // CSV download
    // -------------------------------------------------------------------------
    window.downloadCSV = function (which) {
        var hot = which === "summary" ? summaryHot : detailHot;
        if (!hot) return;

        var data = hot.getData();
        var headers = hot.getColHeader();
        // Strip HTML tags from headers
        var cleanHeaders = headers.map(function (h) {
            return h.replace(/<[^>]*>/g, "");
        });

        var rows = [cleanHeaders].concat(data);
        var csv = rows
            .map(function (row) {
                return row
                    .map(function (cell) {
                        var s = cell == null ? "" : String(cell);
                        if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
                            return '"' + s.replace(/"/g, '""') + '"';
                        }
                        return s;
                    })
                    .join(",");
            })
            .join("\n");

        var d = window.STUDENT_DATA;
        var filename =
            which + "_" + d.studentName + "_" + d.courseName + ".csv";

        var blob = new Blob([csv], { type: "text/csv" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
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
