/*
 * tableToCSV — download an HTML table as a CSV file.
 *
 * Replaces the old jQuery plugin (jquery.tabletoCSV.js). That version pushed a
 * row onto the output for *every* <tr>, including header rows, which contribute
 * no <td> cells and so produced an empty entry; the header and body were then
 * concatenated relying on that empty entry to supply the separating newline.
 * Any table with a second header row — DataTables adds one for sizing when
 * scrolling is enabled — therefore emitted a blank line before the data.
 *
 * This version emits exactly one header line and one line per data row.
 */
(function (global) {
    "use strict";

    function escapeCell(cell) {
        // textContent flattens any markup DataTables injects into a cell
        // (sort indicators, sizing wrappers) down to its visible text.
        var text = (cell.textContent || "").trim();

        return '"' + text.replace(/"/g, '""') + '"';
    }

    function rowToLine(row) {
        return Array.prototype.map.call(row.cells, escapeCell).join(",");
    }

    /*
     * Build the CSV text for a table.
     *
     * Rows with no cells are skipped. The first cell-bearing row made up
     * entirely of <th> is the header; any later header-only row is a duplicate
     * (a DataTables sizing or clone header) and is dropped. Every row with at
     * least one <td> is a data row.
     */
    function tableToCSVText(table) {
        var lines = [];
        var haveHeader = false;

        Array.prototype.forEach.call(table.rows, function (row) {
            var cells = Array.prototype.slice.call(row.cells);

            if (!cells.length) {
                return;
            }

            var isHeaderRow = !cells.some(function (cell) {
                return cell.tagName === "TD";
            });

            if (isHeaderRow) {
                if (haveHeader) {
                    return;
                }
                haveHeader = true;
            }

            lines.push(rowToLine(row));
        });

        return lines.join("\n");
    }

    /*
     * Trigger a download of `table` as CSV. The file is named after the
     * table's <caption> when it has one, and timestamped either way.
     */
    function tableToCSV(table) {
        if (!table) {
            return;
        }

        var csv = tableToCSVText(table);
        var caption = table.querySelector("caption");
        var captionText = caption ? caption.textContent.trim() : "";
        var stamp = new Date().getTime();

        var link = document.createElement("a");

        link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
        link.download = (captionText ? captionText + "-" : "") + stamp + ".csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    global.tableToCSV = tableToCSV;
    global.tableToCSVText = tableToCSVText;
})(window);
