/**
 * report_table.js — read-only tables for the instructor reports
 *
 * Renders an array of row objects (all with the same keys) as a <table>
 * inside a scrolling box whose header row and first column(s) stay in view.
 * Pages that use it load css/report_table.css.
 *
 *   renderReportTable(container, data, {
 *       caption: "...",               // read by screen readers only
 *       headerLabel: (key) => text,   // header text; defaults to the key
 *       headerHref: (key) => url,     // link a column header; null for none
 *       cellClass: (key, value) => cls,  // extra class for a cell; null for none
 *       pinnedColumns: 3,             // columns kept in view on the left; default 1
 *   });
 *
 * Numeric cells are right-aligned. Values are always inserted as text.
 */

(function () {
    "use strict";

    window.renderReportTable = function (container, data, opts) {
        opts = opts || {};
        var keys = Object.keys(data[0]);

        var table = document.createElement("table");
        if (opts.caption) {
            var caption = table.createCaption();
            caption.className = "sr-only";
            caption.textContent = opts.caption;
            container.setAttribute("aria-label", opts.caption);
        }

        var headRow = table.createTHead().insertRow();
        keys.forEach(function (k) {
            var th = document.createElement("th");
            th.scope = "col";
            var label = opts.headerLabel ? opts.headerLabel(k) : k;
            var href = opts.headerHref ? opts.headerHref(k) : null;
            if (href) {
                var link = document.createElement("a");
                link.href = href;
                link.target = "_blank";
                link.textContent = label;
                th.appendChild(link);
            } else {
                th.textContent = label;
            }
            headRow.appendChild(th);
        });

        var body = table.createTBody();
        data.forEach(function (record) {
            var row = body.insertRow();
            keys.forEach(function (k, i) {
                var value = record[k];
                var cell;
                if (i === 0) {
                    cell = document.createElement("th");
                    cell.scope = "row";
                    row.appendChild(cell);
                } else {
                    cell = row.insertCell();
                }
                cell.textContent = value === null || value === undefined ? "" : String(value);
                if (typeof value === "number") cell.classList.add("num");
                var extra = opts.cellClass ? opts.cellClass(k, value) : null;
                if (extra) cell.classList.add(extra);
            });
        });

        // A scrollable region must be reachable by keyboard to be scrolled.
        container.tabIndex = 0;
        container.classList.add("report-table");
        container.replaceChildren(table);
        pinColumns(table, opts.pinnedColumns || 1);
    };

    // The first column is pinned by CSS alone. Each further pinned column
    // sits where the ones before it end, which is only known after layout.
    function pinColumns(table, count) {
        var left = 0;
        var headers = table.tHead.rows[0].cells;
        for (var col = 1; col < count && col < headers.length; col++) {
            left += headers[col - 1].offsetWidth;
            for (var r = 0; r < table.rows.length; r++) {
                var cell = table.rows[r].cells[col];
                cell.classList.add("pinned");
                cell.style.left = left + "px";
            }
        }
    }

    // CSV text for the same row objects, header row first.
    window.reportTableCSV = function (data) {
        var keys = Object.keys(data[0]);
        var rows = [keys].concat(
            data.map(function (record) {
                return keys.map(function (k) {
                    return record[k];
                });
            })
        );
        return rows
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
    };
})();
