import { ActiveCode } from "./activecode.js";

// GDScript ActiveCode handler for RunestoneComponents.
//
// Architectural overview:
//   - The Godot engine runs in a single shared <iframe> pointed at the shell
//     export (GodotShellSingleton). Only one iframe exists per page, owned by
//     whichever GodotActiveCode instance last clicked Run.
//   - The shell export lives at /_static/godot-shell/index.html.
//   - When the student clicks Run, GodotShellSingleton.requestRun() moves the
//     iframe into that instance's placeholder div, reloads it (resetting the
//     engine), then sends the code + exercise metadata via postMessage once the
//     shell posts "ready".
//   - Instances that don't own the iframe show a styled placeholder div.
//   - The shell runs GDPractice checks and posts results back via postMessage.
//   - We render results in the activecode output area and call logAnswer()
//     for grade passback via the standard Runestone API.
//
// The <iframe> approach sidesteps the COOP/COEP header requirement on
// Runestone's main pages — the shell's origin can set those headers
// independently.

// -----------------------------------------------------------------------------
// GodotShellSingleton — owns the one real Godot <iframe> for the entire page.
//
// Lifecycle:
//   - The first GodotActiveCode instance to construct calls init(), which
//     creates the iframe, inserts it into that instance's placeholderDiv, and
//     starts the global postMessage listener.
//   - When any instance calls requestRun(), the singleton moves the iframe to
//     that instance's placeholderDiv (reparenting it in the DOM), reloads the
//     iframe src to reset the engine, and queues the payload for dispatch once
//     the "ready" message arrives.
//   - All run buttons across all instances are disabled during a run and
//     re-enabled only after a "result" or "error" message is received.
// -----------------------------------------------------------------------------
const GodotShellSingleton = {
    // The one shared <iframe>.
    iframe: null,

    // The GodotActiveCode instance whose placeholderDiv currently holds the iframe.
    owner: null,

    // All registered GodotActiveCode instances on this page.
    instances: [],

    // True once the shell loads for the first time.
    shellReady: false,

    // The run queued while the iframe is reloading: { instance, payload } | null.
    pendingRun: null,

    // -------------------------------------------------------------------------
    // Called by each GodotActiveCode constructor. Triggers init() on the first
    // registration.
    // -------------------------------------------------------------------------
    register(instance) {
        this.instances.push(instance);
        if (this.instances.length === 1) {
            this.init(instance);
        }
    },

    // -------------------------------------------------------------------------
    // Creates the shared iframe, inserts it into the first instance's
    // placeholderDiv, and starts the global message listener.
    // The iframe is hidden until the shell posts "ready".
    // -------------------------------------------------------------------------
    init(instance) {
        var iframe = document.createElement("iframe");
        iframe.src = instance.shellUrl;
        iframe.style.width   = "100%";
        iframe.style.height  = "400px";
        iframe.style.border  = "none";
        iframe.style.display = "none";   // hidden until "ready" fires
        iframe.allow = "cross-origin-isolated";

        instance.placeholderDiv.appendChild(iframe);
        this.iframe = iframe;
        this.owner  = instance;

        this._listenForMessages(instance.shellUrl);
    },

    // -------------------------------------------------------------------------
    // Called when an instance's Run button is clicked.
    // Orchestrates: disable buttons → move iframe → reload → queue payload.
    // -------------------------------------------------------------------------
    requestRun(instance, payload) {
        this._setAllRunButtons(false);

        if (!this.shellReady) {
            // Shell is still loading from a previous reload (or first load).
            // Queue this run; it will be dispatched when "ready" fires.
            this.pendingRun = { instance, payload };
            $(instance.output).text("Waiting for Godot engine to load…");
            $(instance.output).css("visibility", "visible");
            return;
        }

        // Shell was idle and ready — begin the move + reload sequence.
        this.pendingRun = { instance, payload };

        // Move the iframe from the current owner to the requesting instance,
        // unless they're the same instance (re-running the same block).
        if (this.owner !== instance) {
            this._releaseFrom(this.owner);
            this._attachTo(instance);
            this.owner = instance;
            // Reload the iframe to fully reset the Godot engine.
            this.iframe.src = this.iframe.src; // eslint-disable-line no-self-assign
        } else {
            this._onShellReady()
        }

        // Reload the iframe to fully reset the Godot engine.
        // The "ready" message will trigger _onShellReady() and dispatch pendingRun.
        //this.iframe.src = this.iframe.src; // eslint-disable-line no-self-assign
    },

    // -------------------------------------------------------------------------
    // Removes the iframe from an instance's placeholderDiv and replaces it
    // with a styled "game is running elsewhere" div.
    // -------------------------------------------------------------------------
    _releaseFrom(instance) {
        if (instance.placeholderDiv.contains(this.iframe)) {
            instance.placeholderDiv.removeChild(this.iframe);
        }

        var msg = document.createElement("div");
        msg.classList.add("godot-elsewhere-placeholder");
        msg.style.cssText = [
            "width: 100%",
            "height: 1.2em",
            "display: flex",
            "align-items: center",
            "justify-content: center",
            "background: #1a1a2e",
            "color: #aaaaaa",
            "font-size: 1.1em",
            "font-family: sans-serif",
            "border: 2px dashed #444444",
            "box-sizing: border-box",
        ].join(";");
        msg.textContent = "▶ Game is running in another exercise";
        instance.placeholderDiv.appendChild(msg);
    },

    // -------------------------------------------------------------------------
    // Removes any "elsewhere" placeholder from an instance's placeholderDiv
    // and inserts the shared iframe.
    // -------------------------------------------------------------------------
    _attachTo(instance) {
        // Remove stale placeholder div if present.
        var existing = instance.placeholderDiv.querySelector(".godot-elsewhere-placeholder");
        if (existing) {
            instance.placeholderDiv.removeChild(existing);
        }
        instance.placeholderDiv.appendChild(this.iframe);
    },

    // -------------------------------------------------------------------------
    // Posts a loadExercise message to the shell iframe.
    // -------------------------------------------------------------------------
    _sendToShell(payload) {
        try {
            const targetOrigin = new URL(this.owner.shellUrl, window.location.href).origin;
            this.iframe.contentWindow.postMessage(
                { type: "loadExercise", payload: payload },
                targetOrigin
            );
        } catch (e) {
            this.owner._onError("Could not communicate with Godot shell: " + e.message);
            this._setAllRunButtons(true);
        }
    },

    // -------------------------------------------------------------------------
    // Called when the shell posts { type: "ready" }.
    // Shows the iframe and dispatches any pending run.
    // Does NOT re-enable run buttons — those stay disabled until result/error.
    // -------------------------------------------------------------------------
    _onShellReady() {
        this.shellReady = true;
        this.iframe.style.display = "block";

        if (this.pendingRun) {
            var { instance, payload } = this.pendingRun;
            this.pendingRun = null;

            // Ensure the iframe is in the right placeholder.
            if (this.owner !== instance) {
                this._releaseFrom(this.owner);
                this._attachTo(instance);
                this.owner = instance;
            }

            this._sendToShell(payload);
        }
    },

    // -------------------------------------------------------------------------
    // Routes a "result" message to the owning instance, then re-enables buttons.
    // -------------------------------------------------------------------------
    _onResult(data) {
        if (this.owner) this.owner._onResult(data);
        this._setAllRunButtons(true);
    },

    // -------------------------------------------------------------------------
    // Routes an "error" message to the owning instance, then re-enables buttons.
    // -------------------------------------------------------------------------
    _onError(message) {
        if (this.owner) this.owner._onError(message);
        this._setAllRunButtons(true);
    },

    // -------------------------------------------------------------------------
    // Routes a "print" message to the owning instance.
    // -------------------------------------------------------------------------
    _onPrint(text) {
        if (this.owner) this.owner._onPrint(text);
    },

    // -------------------------------------------------------------------------
    // Global postMessage listener — registered once by init().
    // Guards:
    //   1. event.source must be the shared iframe's contentWindow.
    //   2. event.origin must match the shell's origin.
    //   3. data.source must be "godot-activecode" (set by Shell.gd).
    // -------------------------------------------------------------------------
    _listenForMessages(shellUrl) {
        const expectedOrigin = new URL(shellUrl, window.location.href).origin;

        window.addEventListener("message", (event) => {
            if (event.source !== this.iframe.contentWindow) return;
            if (event.origin !== expectedOrigin) return;

            var data = event.data;
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
    },

    // -------------------------------------------------------------------------
    // Enables or disables the Run button on every registered instance.
    // -------------------------------------------------------------------------
    _setAllRunButtons(enabled) {
        for (let inst of this.instances) {
            if (inst.runButton) {
                setTimeout(() => {
                    inst.runButton.disabled = !enabled;
                }, 100);
                
            }
        }
    },
};

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

        // unit_results string for logBookEvent, same format as SQL/Python.
        this.unit_results = null;

        // Buffer for print() lines received before or between result messages.
        // Cleared at the start of each run and displayed in this.output
        // alongside the final summary.
        this._printLines = [];

        this._createPlaceholder();

        // Register with the singleton. The first instance triggers iframe creation.
        GodotShellSingleton.register(this);
    }

    // -------------------------------------------------------------------------
    // Creates the placeholder div that will hold either the shared iframe (when
    // this instance owns it) or the "game is running elsewhere" styled div.
    // Also creates the results table container, which is always per-instance and
    // stays in place regardless of which instance owns the iframe.
    // -------------------------------------------------------------------------
    _createPlaceholder() {
        // Placeholder — same dimensions as the iframe so layout doesn't shift.
        var placeholder = document.createElement("div");
        placeholder.style.width  = "100%";
        this.outDiv.parentNode.insertBefore(placeholder, this.outDiv);
        this.placeholderDiv = placeholder;

        // Results table container, inserted between the placeholder and the
        // plain-text output div. Hidden and empty until the first result.
        var resultsDiv = document.createElement("div");
        resultsDiv.classList.add("unittest-results");
        resultsDiv.id = this.divid + "_unit_results";
        resultsDiv.style.display = "none";
        this.outDiv.parentNode.insertBefore(resultsDiv, this.outDiv);
        this.unitResultsDiv = resultsDiv;
    }

    // -------------------------------------------------------------------------
    // Called when the shell posts { type: "result", passed, score, checks }.
    // Renders a results table (mirroring Python's unittest.gui table) above
    // the plain-text output area, and logs the grade.
    // -------------------------------------------------------------------------
    _onResult(data) {
        this._renderResultsTable(data);

        var pct = Math.round((data.score || 0) * 100);

        // Plain text output should be based on 
        // print() output captured during the run, separated from
        // the summary line by a blank line.
        var summaryLine = $(this.output).text().toLowerCase().includes("error") ? $(this.output).text() : "No Errors";
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
        
        var summary = document.createElement("p");
        if ((!data.checks || data.checks.length == 0) && (!data.requirements || data.requirements.length == 0)) {
            summary.textContent = "No tests.";
        } else {
            // Summary paragraph, mirroring Python's "You passed: X% of the tests".
            var pct = Math.round((data.score || 0) * 100);
            summary.textContent = `You passed: ${pct}% of the tests`;
        

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

            
        }
        container.appendChild(summary);

        container.style.display = "block";
    }

    // -------------------------------------------------------------------------
    // Appends a single result row to the table.
    // status is one of "pass", "fail", or "error".
    // -------------------------------------------------------------------------
    _appendResultRow(table, status, description, hint) {
        const STATUS = {
            pass:     { label: "Pass",     cls: "ac-feedback-pass" },
            fail:     { label: "Fail",     cls: "ac-feedback-fail" },
            disabled: { label: "Disabled", cls: "ac-feedback-fail" },
            error:    { label: "Error",    cls: "ac-feedback-fail" },
            unknown:  { label: "Unknown",  cls: "ac-feedback-fail" },
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
    // Reads the student's code from the editor and delegates to the singleton.
    // -------------------------------------------------------------------------
    async runProg(noUI, logResults) {
        if (typeof logResults === "undefined") {
            this.logResults = true;
        } else {
            this.logResults = logResults;
        }

        // Clear previous output and results table for this instance.
        $(this.output).text("Running…");
        $(this.output).css("visibility", "visible");
        $(this.output).removeClass("error");
        this.unitResultsDiv.innerHTML = "";
        this.unitResultsDiv.style.display = "none";
        this._printLines = [];

        // Get the student's code from the CodeMirror editor.
        var studentCode = this.editor.getValue();
        console.log("GodotActiveCode: this suffix is:", this.suffix);
        var payload = {
            pck:    this.pckUrl,
            scene:  this.sceneId,
            code:   studentCode,
            test:   this.suffix,
            origin: window.location.origin,
        };

        GodotShellSingleton.requestRun(this, payload);

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
