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
        console.log("GodotActiveCode constructor called for", opts.orig.id);
    
        // Resolve the base URL for the Godot shell export.
        // data-wasm on the textarea holds the path to the shell directory,
        // e.g. "/_static/godot-shell" — mirrors how SQL uses data-wasm.
        var shellBase;
        if (
            eBookConfig.useRunestoneServices ||
            window.location.search.includes("mode=browsing")
        ) {
            // On a Runestone server, prefix with the published book path.
            var bookprefix = `/ns/books/published/${eBookConfig.basecourse}`;
            shellBase = bookprefix + $(this.origElem).data("wasm");
        } else {
            // Static build — use the path as-is, relative to the book root.
            shellBase = $(this.origElem).data("wasm");
        }
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
                this.pckUrl = `${currentDir}/${this.pckUrl}`;
            }
            
        }

        // Track whether the shell iframe is ready to receive exercises.
        this.shellReady = false;
        // Queue a loadExercise call if Run is clicked before shell is ready.
        this._pendingRun = null;

        // unit_results string for logBookEvent, same format as SQL/Python.
        this.unit_results = null;

        this._createIframe();
        console.log("GodotActiveCode calling _listenForMessages");
        this._listenForMessages();
    }

    // -------------------------------------------------------------------------
    // Creates the <iframe> that hosts the Godot shell and inserts it into
    // the activecode output area. The iframe is hidden until the shell is ready.
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
    }

    // -------------------------------------------------------------------------
    // Listens for postMessage events from the Godot shell.
    // Shell always sets event.data.source === "godot-activecode".
    // -------------------------------------------------------------------------
    _listenForMessages() {
        window.addEventListener("message", (event) => {
            var data = event.data;
            
            if (!data || data.source !== "godot-activecode") return;
            console.log("activecode_gdscript received message:", data);
            console.log("gdscript handler processing:", data.type);
        
            switch (data.type) {
                case "ready":
                    this._onShellReady();
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
            this.godotIframe.contentWindow.godotShell.loadExercise(payload);
        } catch (e) {
            this._onError("Could not communicate with Godot shell: " + e.message);
        }
    }

    // -------------------------------------------------------------------------
    // Called when the shell posts { type: "result", passed, score, checks }.
    // Renders check results and logs the grade.
    // -------------------------------------------------------------------------
    _onResult(data) {
        // Build a human-readable summary for the output area.
        var lines = [];
        if (data.requirements && data.requirements.length > 0) {
            lines.push("Requirements not met:");
            for (let r of data.requirements) {
                lines.push(`  ✗ ${r.description}: ${r.hint}`);
            }
        }
        for (let check of (data.checks || [])) {
            var icon = check.passed ? "✓" : "✗";
            lines.push(`${icon} ${check.description}`);
            if (!check.passed && check.hint) {
                lines.push(`    Hint: ${check.hint}`);
            }
            // Show subchecks if present.
            for (let sub of (check.subchecks || [])) {
                var subIcon = sub.passed ? "  ✓" : "  ✗";
                lines.push(`${subIcon} ${sub.description}`);
                if (!sub.passed && sub.hint) {
                    lines.push(`      Hint: ${sub.hint}`);
                }
            }
        }
        var pct = Math.round((data.score || 0) * 100);
        lines.push(`\n${data.passed ? "All checks passed!" : "Some checks failed."} (${pct}%)`);

        $(this.output).text(lines.join("\n"));
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
    // Called when the shell posts { type: "error", message }.
    // -------------------------------------------------------------------------
    _onError(message) {
        $(this.output).text("Error: " + message);
        $(this.output).css("visibility", "visible");
        $(this.output).addClass("error");
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

        // Get the student's code from the CodeMirror editor.
        var studentCode = this.editor.getValue();

        var payload = {
            pck:   this.pckUrl,
            scene: this.sceneId,
            code:  studentCode,
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
