import { describe, it, expect, beforeEach } from "vitest";
import SQLActiveCode from "../js/activecode_sql.js";

beforeEach(() => {
    document.body.innerHTML = "";
});

describe("SQLActiveCode query results", () => {
    it("captions the main result table, not Handsontable's overlays", async () => {
        const ac = Object.create(SQLActiveCode.prototype);
        ac.divid = "test_sql_results";
        ac.outDiv = document.createElement("div");
        ac.output = document.createElement("pre");
        ac.outDiv.appendChild(ac.output);
        document.body.appendChild(ac.outDiv);
        ac.buildProg = async () => "SELECT 42";
        ac.manage_scrubber = async () => "True";
        ac.showOutput = () => {};

        let readRow = false;
        ac.db = {
            iterateStatements: () => [
                {
                    getColumnNames: () => ["answer"],
                    step: () => {
                        if (readRow) return false;
                        readRow = true;
                        return true;
                    },
                    get: () => [42],
                },
            ],
        };

        await ac.runProg();

        const results = ac.outDiv.querySelector(".ac_sql_result");
        const mainTable = results.querySelector(".ht_master table.htCore");
        expect(mainTable.caption.textContent).toBe("Query results");
        expect(mainTable.caption.classList.contains("visuallyhidden")).toBe(
            true,
        );
        expect(results.querySelectorAll("table caption")).toHaveLength(1);
    });
});
