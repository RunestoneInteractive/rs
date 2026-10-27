import { describe, it, expect, beforeEach } from "vitest";
import SQLActiveCode from "../js/activecode_sql.js";

beforeEach(() => {
    document.body.innerHTML = "";
});

// Run one statement through SQLActiveCode.runProg against a fake sql.js
// database that returns ``rows`` under ``columns``.
async function runQuery(columns, rows) {
    const ac = Object.create(SQLActiveCode.prototype);
    ac.divid = "test_sql_results";
    ac.outDiv = document.createElement("div");
    ac.output = document.createElement("pre");
    ac.outDiv.appendChild(ac.output);
    document.body.appendChild(ac.outDiv);
    ac.buildProg = async () => "SELECT 42";
    ac.manage_scrubber = async () => "True";
    ac.showOutput = () => {};

    let next = 0;
    ac.db = {
        iterateStatements: () => [
            {
                getColumnNames: () => columns,
                step: () => next < rows.length,
                get: () => rows[next++],
            },
        ],
    };

    await ac.runProg();
    return ac.outDiv.querySelector(".ac_sql_result");
}

describe("SQLActiveCode query results", () => {
    it("shows the result as a captioned table with column headers", async () => {
        const results = await runQuery(
            ["name", "answer"],
            [
                ["a", 42],
                ["b", null],
            ],
        );

        const tables = results.querySelectorAll("table");
        expect(tables).toHaveLength(1);
        const table = tables[0];
        expect(table.caption.textContent).toBe("Query results");
        expect(table.caption.classList.contains("visuallyhidden")).toBe(true);

        const headers = [...table.querySelectorAll("thead th")];
        expect(headers.map((th) => th.textContent)).toEqual(["name", "answer"]);
        expect(headers.every((th) => th.scope === "col")).toBe(true);

        const cells = [...table.tBodies[0].rows].map((r) =>
            [...r.cells].map((c) => c.textContent),
        );
        expect(cells).toEqual([
            ["a", "42"],
            ["b", ""],
        ]);
    });

    it("keeps the column headers when the query returns no rows", async () => {
        const results = await runQuery(["id"], []);
        const table = results.querySelector("table");
        expect(table.querySelector("thead th").textContent).toBe("id");
        expect(table.tBodies[0].rows).toHaveLength(0);
    });

    it("shows at most 100 rows and says so", async () => {
        const rows = Array.from({ length: 150 }, (_, i) => [i]);
        const results = await runQuery(["n"], rows);
        expect(results.querySelector("tbody").rows).toHaveLength(100);
        expect(results.textContent).toContain("only first 100 rows displayed");
    });

    it("scrolls inside a keyboard-focusable box of limited height", async () => {
        const results = await runQuery(["n"], [[1]]);
        const box = results.querySelector(".sql_result_table");
        expect(box.style.maxHeight).toBe("350px");
        expect(box.tabIndex).toBe(0);
        expect(box.getAttribute("aria-label")).toBe("Query results");
    });
});
