// A read-only table of SQL query results, shared by activecode and hparsons.
//
// ``tableData`` is a result from sql.js: ``columns`` is the list of column
// names and ``values`` the list of rows. At most ``MAX_ROWS`` rows are shown;
// the callers already tell the reader when the result was cut short. The table
// scrolls inside a box no taller than ``maxHeight`` pixels, with the header row
// kept in view.

const MAX_ROWS = 100;

export function createResultTable(tableData, container, maxHeight, caption) {
    const wrapper = document.createElement("div");
    wrapper.className = "sql_result_table";
    wrapper.style.maxHeight = `${maxHeight}px`;
    // A scrollable region must be reachable by keyboard to be scrolled.
    wrapper.tabIndex = 0;

    const table = document.createElement("table");
    if (caption) {
        const cap = table.createCaption();
        cap.className = "visuallyhidden";
        cap.textContent = caption;
        wrapper.setAttribute("aria-label", caption);
    }

    const headRow = table.createTHead().insertRow();
    for (const name of tableData.columns) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = name;
        headRow.appendChild(th);
    }

    const body = table.createTBody();
    for (const values of tableData.values.slice(0, MAX_ROWS)) {
        const row = body.insertRow();
        for (const value of values) {
            // sql.js gives NULL as null; show it as an empty cell.
            row.insertCell().textContent = value === null ? "" : String(value);
        }
    }

    wrapper.appendChild(table);
    container.appendChild(wrapper);
    return table;
}
