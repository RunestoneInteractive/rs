import { ActiveCode } from "./activecode.js";

// GDScript ActiveCode handler for RunestoneComponents.
//
// Architectural overview:
//   - The Godot engine runs in an <iframe> pointed at the shell export.
//   - The shell export lives at /_static/godot-shell/index.html.
//   - When the student clicks Run, we post the code + exercise metadata
//     to the shell via window.godotShell.loadExercise().
//   - The shell runs GDPractice checks and posts results back via postMessage.
//   - We render results in the activecode output area and call logAnswer()
//     for grade passback via the standard Runestone API.
//
// The <iframe> approach sidesteps the COOP/COEP header requirement on
// Runestone's main pages — the shell's origin can set those headers
// independently.

export default class GodotActiveCode extends ActiveCode {
    constructor(opts) {
        super(opts);
        //console.log("GodotActiveCode constructor called for", opts.orig.id);
    
        // Resolve the base URL for the Godot shell export.
        // data-wasm on the textarea holds the path to the shell directory,
        // e.g. "/_static/godot-shell" — mirrors how SQL uses data-wasm.
        var shellBase;
        // if (
        //     eBookConfig.useRunestoneServices ||
        //     window.location.search.includes("mode=browsing")
        // ) {
        //     // On a Runestone server, prefix with the published book path.
        //     var bookprefix = `/ns/books/published/${eBookConfig.basecourse}`;
        //     shellBase = bookprefix + $(this.origElem).data("wasm");
        // } else {
            // Static build — use the path as-is, relative to the book root.
            shellBase = $(this.origElem).data("wasm");
        // }
        this.shellUrl = shellBase + "/index.html";

        // Per-exercise .pck URL and scene path, emitted by PreTeXt XSLT.
        this.pckUrl   = $(this.origElem).data("pck")   || "";
        this.sceneId  = $(this.origElem).data("scene") || "";

        // Resolve pck URL for Runestone server vs static build,
        // mirroring how SQL resolves dburl.
        if (this.pckUrl) {
            if (
                eBookConfig.useRunestoneServices ||
                window.location.search.includes("mode=browsing")
            ) {
                if (this.pckUrl.startsWith("external")) {
                    // PTX markup on Runestone server
                    var bookprefix = `/ns/books/published/${eBookConfig.basecourse}`;
                    this.pckUrl = `${window.location.origin}/${bookprefix}/${this.pckUrl}`;
                }
            } else {
                const currentDir = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
                this.pckUrl = `${currentDir}${this.pckUrl}`;
            }
            
        }

        // Track whether the shell iframe is ready to receive exercises.
        this.shellReady = false;
        // Queue a loadExercise call if Run is clicked before shell is ready.
        this._pendingRun = null;

        // unit_results string for logBookEvent, same format as SQL/Python.
        this.unit_results = null;

        this._createIframe();
        //console.log("GodotActiveCode calling _listenForMessages");
        this._listenForMessages();
    }

    // -------------------------------------------------------------------------
    // Creates the <iframe> that hosts the Godot shell and inserts it into
    // the activecode output area. The iframe is hidden until the shell is ready.
    // Also creates an empty results table container, mirroring the
    // .unittest-results div that Python's unittest.gui module builds —
    // this is rendered separately from (and above) the plain-text output area.
    // -------------------------------------------------------------------------
    _createIframe() {
        var iframe = document.createElement("iframe");
        iframe.src = this.shellUrl;
        iframe.style.width   = "100%";
        iframe.style.height  = "400px";
        iframe.style.border  = "none";
        iframe.style.display = "none";   // hidden until "ready" fires
        // allow cross-origin isolation inside the iframe
        iframe.allow = "cross-origin-isolated";

        // Insert above the standard activecode output div.
        this.outDiv.parentNode.insertBefore(iframe, this.outDiv);
        this.godotIframe = iframe;

        // Results table container, inserted between the iframe and the
        // plain-text output div. Hidden and empty until the first result.
        var resultsDiv = document.createElement("div");
        resultsDiv.classList.add("unittest-results");
        resultsDiv.id = this.divid + "_unit_results";
        resultsDiv.style.display = "none";
        this.outDiv.parentNode.insertBefore(resultsDiv, this.outDiv);
        this.unitResultsDiv = resultsDiv;

        // Buffer for print() lines received before or between result messages.
        // Cleared at the start of each run and displayed in this.output
        // alongside the final summary.
        this._printLines = [];
    }

    // -------------------------------------------------------------------------
    // Listens for postMessage events from the Godot shell.
    // Two guards are applied before handling a message:
    //   1. event.source === this.godotIframe.contentWindow — ensures we only
    //      handle messages from *this* instance's iframe, not from any other
    //      GodotActiveCode iframe on the same page.
    //   2. data.source === "godot-activecode" — ensures we only handle
    //      messages intentionally sent by Shell.gd, ignoring anything else
    //      posted to the window (browser extensions, other widgets, etc.).
    // -------------------------------------------------------------------------
    _listenForMessages() {
        window.addEventListener("message", (event) => {
            // Guard 1: message must come from this instance's iframe and expected origin.
            const expectedOrigin = new URL(this.shellUrl, window.location.href).origin;
            if (event.source !== this.godotIframe.contentWindow || event.origin !== expectedOrigin) return;

            var data = event.data;

            // Guard 2: message must be from Shell.gd.
            if (!data || data.source !== "godot-activecode") return;

            switch (data.type) {
                case "ready":
                    this._onShellReady();
                    break;
                case "print":
                    this._onPrint(data.text);
                    break;
                case "result":
                    this._onResult(data);
                    break;
                case "error":
                    this._onError(data.message);
                    break;
            }
        });
    }

    // -------------------------------------------------------------------------
    // Called when the shell posts { type: "ready" }.
    // Show the iframe and dispatch any pending run.
    // -------------------------------------------------------------------------
    _onShellReady() {
        this.shellReady = true;
        this.godotIframe.style.display = "block";
        if (this._pendingRun) {
            this._sendToShell(this._pendingRun);
            this._pendingRun = null;
        }
    }

    // -------------------------------------------------------------------------
    // Sends the exercise payload to the shell via the JavaScriptBridge API
    // that Shell.gd registers on window.godotShell.
    // -------------------------------------------------------------------------
    _sendToShell(payload) {
        try {
            // Specify your remote server origin for security
            const targetOrigin = new URL(this.shellUrl, window.location.href).origin;

            this.godotIframe.contentWindow.postMessage(
                { type: "loadExercise", payload: payload },
                targetOrigin
            );
        } catch (e) {
            this._onError("Could not communicate with Godot shell: " + e.message);
        }
    }

    // -------------------------------------------------------------------------
    // Called when the shell posts { type: "result", passed, score, checks }.
    // Renders a results table (mirroring Python's unittest.gui table) above
    // the plain-text output area, and logs the grade.
    // -------------------------------------------------------------------------
    _onResult(data) {
        this._renderResultsTable(data);

        var pct = Math.round((data.score || 0) * 100);

        // The plain-text output area now only shows the final summary line,
        // matching Python's "You passed: X% of the tests" paragraph — the
        // per-check detail lives in the table instead.
        // Prepend any print() output captured during the run, separated from
        // the summary line by a blank line — matching how Python's stdout
        // appears above the unittest summary in standard activecode blocks.
        var summaryLine = `${data.passed ? "All checks passed!" : "Some checks failed."} (${pct}%)`;
        var outputText = this._printLines.length > 0
            ? this._printLines.join("\n") + "\n\n" + summaryLine
            : summaryLine;
        $(this.output).text(outputText);
        $(this.output).css("visibility", "visible");

        // Store unit_results in the same format Runestone expects for
        // unittest events (matches Python/SQL grade passback format).
        var passed  = data.checks ? data.checks.filter(c => c.passed).length : 0;
        var failed  = data.checks ? data.checks.filter(c => !c.passed).length : 0;
        this.unit_results = `percent:${pct}:passed:${passed}:failed:${failed}`;
        this.testResult   = data.passed;

        // Trigger standard Runestone grade logging.
        this.logCurrentAnswer();
    }

    // -------------------------------------------------------------------------
    // Builds the results table into this.unitResultsDiv, replacing any
    // previous contents. Mirrors the structure of the table that Python's
    // unittest.gui module (skulpt src/lib/unittest/gui.py, TestCaseGui.main /
    // appendResult) builds: a <table> with a header row and one row per
    // check/subcheck/requirement, using the same `ac-feedback` /
    // `ac-feedback-pass` / `ac-feedback-fail` classes as the Python table so
    // it picks up the site's existing CSS (see activecode.css
    // .unittest-results, .ac-feedback*).
    // -------------------------------------------------------------------------
    _renderResultsTable(data) {
        var container = this.unitResultsDiv;
        container.innerHTML = "";

        var table = document.createElement("table");

        // Header row. Python's table uses Result | Actual | Expected | Notes;
        // GDPractice checks don't have actual/expected values, so we use
        // Result | Description | Hint instead.
        var headerRow = document.createElement("tr");
        for (let label of ["Result", "Description", "Hint"]) {
            var th = document.createElement("th");
            th.classList.add("ac-feedback");
            th.style.textAlign = "center";
            th.textContent = label;
            headerRow.appendChild(th);
        }
        table.appendChild(headerRow);

        // Requirement failures are reported like Python's "Error" rows —
        // they indicate the checks couldn't run at all, rather than a
        // pass/fail on student logic.
        for (let r of (data.requirements || [])) {
            this._appendResultRow(table, "error", r.description, r.hint);
        }

        for (let check of (data.checks || [])) {
            this._appendResultRow(table, check.status, check.description, check.hint);
            for (let sub of (check.subchecks || [])) {
                this._appendResultRow(table, sub.passed ? "pass" : "fail", `— ${sub.description}`, sub.hint);
            }
        }

        container.appendChild(table);

        // Summary paragraph, mirroring Python's "You passed: X% of the tests".
        var pct = Math.round((data.score || 0) * 100);
        var summary = document.createElement("p");
        summary.textContent = `You passed: ${pct}% of the tests`;
        container.appendChild(summary);

        container.style.display = "block";
    }

    // -------------------------------------------------------------------------
    // Appends a single result row to the table.
    // status is one of "pass", "fail", or "error".
    // -------------------------------------------------------------------------
    _appendResultRow(table, status, description, hint) {
        const STATUS = {
            pass:  { label: "Pass",  cls: "ac-feedback-pass" },
            fail:  { label: "Fail",  cls: "ac-feedback-fail" },
            disabled: {label: "Disabled", cls: "ac-feedback-fail"},
            error: { label: "Error", cls: "ac-feedback-fail" },
            unknown: {label: "Unknown", cls: "ac-feedback-fail"},
        };
        var info = STATUS[status] || STATUS.unknown;

        var row = document.createElement("tr");

        var resultCell = document.createElement("td");
        resultCell.classList.add("ac-feedback", info.cls);
        resultCell.style.textAlign = "center";
        resultCell.textContent = info.label;
        row.appendChild(resultCell);

        var descCell = document.createElement("td");
        descCell.classList.add("ac-feedback");
        descCell.textContent = description || "";
        row.appendChild(descCell);

        var hintCell = document.createElement("td");
        hintCell.classList.add("ac-feedback");
        // Only show the hint when it's relevant — i.e. not on a pass.
        hintCell.textContent = (status === "pass") ? "" : (hint || "");
        row.appendChild(hintCell);

        table.appendChild(row);
    }

    // -------------------------------------------------------------------------
    // Called when the shell posts { type: "print", text }.
    // Godot's web export routes print() to console.log; Shell.gd monkey-patches
    // console.log inside the iframe to also forward each line here.
    // Lines are buffered and displayed above the result summary in this.output.
    // -------------------------------------------------------------------------
    _onPrint(text) {
        if (typeof text !== "string") return;
        // Filter out Godot engine internal messages that aren't student output.
        // These include WebGL notices, shader compile messages, and the progress
        // save confirmation that db.gd emits ("Progress saved successfully").
        if (text.startsWith("WebGL") ||
            text.startsWith("Godot") ||
            text.startsWith("Progress saved") ||
            text.startsWith("vram")) return;

        this._printLines.push(text);

        // Show print output immediately as it arrives, so students see it
        // even before the result comes back (e.g. during a long sample window).
        var current = $(this.output).text();
        $(this.output).text(
            current ? current + "\n" + text : text
        );
        $(this.output).css("visibility", "visible");
    }

    // -------------------------------------------------------------------------
    // Called when the shell posts { type: "error", message }.
    // -------------------------------------------------------------------------
    _onError(message) {
        $(this.output).text("Error: " + message);
        $(this.output).css("visibility", "visible");
        $(this.output).addClass("error");

        // Hide any stale results table from a previous run.
        this.unitResultsDiv.style.display = "none";
        this.unitResultsDiv.innerHTML = "";
    }

    // -------------------------------------------------------------------------
    // Override runProg() — called when the student clicks Run.
    // Reads the student's code from the editor and sends it to the shell.
    // -------------------------------------------------------------------------
    async runProg(noUI, logResults) {
        if (typeof logResults === "undefined") {
            this.logResults = true;
        } else {
            this.logResults = logResults;
        }

        // Clear previous output.
        $(this.output).text("Running…");
        $(this.output).css("visibility", "visible");
        $(this.output).removeClass("error");

        // Clear any results table and print buffer from a previous run.
        this.unitResultsDiv.innerHTML = "";
        this.unitResultsDiv.style.display = "none";
        this._printLines = [];

        // Get the student's code from the CodeMirror editor.
        var studentCode = this.editor.getValue();
        //console.log("GodotActiveCode: this suffix is:", this.suffix);
        var payload = {
            pck:   this.pckUrl,
            scene: this.sceneId,
            code:  studentCode,
            test:  this.suffix,
            origin: window.location.origin,
        };

        if (this.shellReady) {
            this._sendToShell(payload);
        } else {
            // Shell is still loading — queue the run for when it's ready.
            this._pendingRun = payload;
            $(this.output).text("Waiting for Godot engine to load…");
        }

        return Promise.resolve("done");
    }

    // -------------------------------------------------------------------------
    // Override logCurrentAnswer() to log both the run event and the
    // unittest result, mirroring the SQL implementation.
    // -------------------------------------------------------------------------
    async logCurrentAnswer(sid) {
        let data = {
            div_id:   this.divid,
            code:     this.editor.getValue(),
            language: this.language,
            errinfo:  this.testResult ? "passed" : "failed",
            to_save:  this.saveCode,
            prefix:   this.pretext,
            suffix:   this.suffix,
            partner:  this.partner,
        };
        if (typeof sid !== "undefined") {
            data.sid = sid;
        }
        await this.logRunEvent(data);

        if (this.unit_results) {
            let unitData = {
                event:   "unittest",
                div_id:  this.divid,
                course:  eBookConfig.course,
                act:     this.unit_results,
            };
            if (typeof sid !== "undefined") {
                unitData.sid = sid;
            }
            await this.logBookEvent(unitData);
        }
    }
}
