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


//export default class DoctestTestParser {
class DoctestTestParser {
    constructor(output, parentId) {

        let [pre, testDetails, report] = output.split("===============================================================================");

        // Produce the output that we will display to the user - their output and the test output
        let cleanedOutput = "\n";
        let programOutLines = pre.split("\n").slice(2);
        if (programOutLines.length > 0 ) {
            cleanedOutput = "Program output:\n";
            for (let line of programOutLines) {
                cleanedOutput += line + "\n";
            }
        }

        let testOutputLines = testDetails.split("\n");
        if(testOutputLines.length > 0) {
            cleanedOutput += "Test messages:\n";
            for (let line of testOutputLines) {
                cleanedOutput += line + "\n";
            }
        }

        
        let reportLines = report.split("\n");
        if(reportLines.length > 0) {
            cleanedOutput += "Test output:\n";
            for (let line of testOutputLines) {
                cleanedOutput += line + "\n";
            }
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

            this.passed = match.groups.passed;
            this.failed = match.groups.failed;

            // Make a pretty results table
            let parent = document.createElement("div");
            parent.classList.add("unittest-results");
            let tbl = document.createElement("table");
            tbl.classList.add("ac-feedback");
            parent.appendChild(tbl);
            parent.setAttribute("id", `${parentId}_unit_results`);
            let trh = document.createElement("tr");
            trh.innerHTML =
                '<th class="ac-feedback">Result</th><th class="ac-feedback">Assertions checked:</th><th class="ac-feedback">Passed:</th><th class="ac-feedback">Failed:</th>';
            tbl.appendChild(trh);
            let tr = document.createElement("tr");
            let td = document.createElement("td");
            td.classList.add("ac-feedback");
            if (this.pct == 100) {
                td.innerHTML = "Pass";
                td.style =
                    "background-color: rgb(131, 211, 130); text-align: center;";
            } else {
                td.innerHTML = "Fail";
                td.style =
                    "background-color: rgb(222, 142, 150); text-align: center;";
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
