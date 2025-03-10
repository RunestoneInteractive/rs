// var testString = `[doctest] doctest version is "2.4.11"
// [doctest] run with "--help" for options
// asdf===============================================================================
// prog.c:11:
// TEST CASE:  Factorials are computed

// prog.c:15: ERROR: CHECK( factorial( 3) == 16 ) is NOT correct!
//   values: CHECK( 6 == 16 )

// ===============================================================================
// [doctest] test cases: 1 | 0 passed | 1 failed | 0 skipped
// [doctest] assertions: 6 | 5 passed | 1 failed |
// [doctest] Status: FAILURE!
// `;


export default class DoctestTestParser {
    constructor(output, parentId) {
        const sep = "===============================================================================";

        // Split the output into the program output, the test output, and the test results
        // If all tests pass, there are no testDetails
        let parts = output.split(sep);

        let pre, testDetails, report;
        if (parts.length > 2) {
            pre = parts[0];
            testDetails = parts[1];
            report = parts[2];
        } else {
            pre = parts[0];
            testDetails = "";
            report = parts[1];
        }

        // Produce the output that we will display to the user - their output and the test output
        let cleanedOutput = "\n";
        let programOutLines = pre.split("\n").slice(2);  // Trim doxygen cruft
        cleanedOutput = "Program output:\n";
        for (let line of programOutLines) {
            cleanedOutput += line + "\n";
        }
        cleanedOutput += sep + "\n";

        // If there are test details, add them to the output
        if (testDetails.trim() != "") {
            let testOutputLines = testDetails.split("\n");
            cleanedOutput += "Test messages:";
            for (let line of testOutputLines) {
                cleanedOutput += line + "\n";
            }
            cleanedOutput += sep + "\n";
        }

        let reportLines = report.split("\n");
        cleanedOutput += "Test results:";
        for (let line of reportLines) {
            cleanedOutput += line + "\n";
        }

        cleanedOutput = cleanedOutput.trim();
        this.stdout = cleanedOutput;

        // Parse the test results for use by autograder
        let patt = new RegExp(
            "\\[doctest\\] assertions: (?<tests>\\d+?) \\| (?<passed>\\d+?) passed \\| (?<failed>\\d+?) failed",
            "g"
        );

        let matches = [...report.matchAll(patt)];
        if (matches.length > 0) {
            let match = matches[0];
            this.pct = 100 * match.groups.passed / match.groups.tests;

            let pctString = document.createElement("span");
            pctString.innerHTML = match[0].replace("[doctest] ", "");
            this.pctString = pctString;

            this.passed = parseInt(match.groups.passed);
            this.failed = parseInt(match.groups.failed);

            // Make a pretty results table
            let parent = document.createElement("div");
            parent.classList.add("unittest-results");
            let tbl = document.createElement("table");
            tbl.classList.add("ac-feedback");
            parent.appendChild(tbl);
            parent.setAttribute("id", `${parentId}_unit_results`);
            let trh = document.createElement("tr");
            trh.innerHTML =
                `<th class="ac-feedback">Result</th><th class="ac-feedback">${$.i18n("msg_activecode_assertions_checked")}</th><th class="ac-feedback">Passed:</th><th class="ac-feedback">Failed:</th>`;
            tbl.appendChild(trh);
            let tr = document.createElement("tr");
            let td = document.createElement("td");
            td.classList.add("ac-feedback");
            if (this.pct == 100) {
                td.innerHTML = $.i18n("msg_activecode_passed");
                td.classList.add("ac-feedback-pass");
            } else {
                td.innerHTML = $.i18n("msg_activecode_failed");
                td.classList.add("ac-feedback-fail");
            }
            tr.appendChild(td);
            tbl.appendChild(tr);

            td = document.createElement("td");
            td.innerHTML = this.passed + this.failed;
            td.classList.add("ac-feedback");
            tr.appendChild(td);

            td = document.createElement("td");
            td.innerHTML = this.passed;
            td.classList.add("ac-feedback");
            tr.appendChild(td);

            td = document.createElement("td");
            td.innerHTML = this.failed;
            td.classList.add("ac-feedback");
            tr.appendChild(td);

            tbl.appendChild(tr);
            this.table = parent;
        }
    }
}

// let x = new DoctestTestParser(testString);
// console.log(x);
