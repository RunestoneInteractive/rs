import { ActiveCode } from "./activecode.js";
import { t } from "../../common/js/rsi18n.js";

export default class HTMLActiveCode extends ActiveCode {
    constructor(opts) {
        super(opts);
        // The base class reads code via textContent which already decodes HTML entities
        // (the browser HTML parser decodes &lt; etc. in textarea content).
        // We must NOT re-read from origElem.innerHTML here — that would re-include the
        // suffix that the base class already stripped into this.suffix.
        this.runButton.textContent = "Render";
        this.editor.setValue(this.code);
        this._messageHandler = null;
    }

    async runProg() {
        let saveCode = "True";
        this.saveCode = await this.manage_scrubber(saveCode);
        this.outDiv.style.visibility = "visible";

        if (this.suffix) {
            // Build without suffix — we inject the harness + suffix ourselves
            var prog = await this.buildProg(false);
            const rawHtmlSource = prog;
            this.testResultsDiv.innerHTML = "";
            this.testResultsDiv.style.display = "none";

            if (this._messageHandler) {
                window.removeEventListener("message", this._messageHandler);
            }
            this._messageHandler = (event) => {
                if (
                    event.data &&
                    event.data.type === "rsTestResults" &&
                    event.source === this.output.contentWindow
                ) {
                    this.displayTestResults(event.data.results);
                    window.removeEventListener("message", this._messageHandler);
                    this._messageHandler = null;
                }
            };
            window.addEventListener("message", this._messageHandler);

            prog =
                `<script type=text/javascript>window.onerror = function(msg,url,line) {alert(msg+' on line: '+line);};<\/script>` +
                prog +
                this._testHarnessScript(rawHtmlSource) +
                `<script type=text/javascript>\nwindow.addEventListener('load', function() {\ntry {\n${this.suffix}\n} catch(e) { window.__rsTestError(e); }\n__rsRunTests();\n});\n<\/script>`;
        } else {
            var prog = await this.buildProg(true);
            prog =
                `<script type=text/javascript>window.onerror = function(msg,url,line) {alert(msg+' on line: '+line);};<\/script>` +
                prog;
        }

        this.output.textContent = "";
        this.output.srcdoc = prog;

        if (this.unit_results) {
            let eventData = {
                act: this.unit_results,
                div_id: this.divid,
                event: "unittest",
            };
            if (typeof sid !== "undefined") {
                eventData.sid = sid;
            }
            this.logBookEvent(eventData);
        }
    }

    _testHarnessScript(rawHtmlSource) {
        const rawHtmlForScript = JSON.stringify(rawHtmlSource || "").replace(
            /<\//g,
            "<\\/",
        );
        return `<script type=text/javascript>
(function() {
    var __rsRawHtmlSource = ${rawHtmlForScript};
    var __rsResults = [];

    function __pass(msg) { __rsResults.push({ pass: true, message: msg }); }
    function __fail(msg) { __rsResults.push({ pass: false, message: msg }); }

    window.__rsTestError = function(e) {
        __fail("Test error: " + e.message);
    };

    window.assertExists = function(selector, msg) {
        msg = msg || ("Element '" + selector + "' exists");
        if (document.querySelector(selector)) { __pass(msg); }
        else { __fail(msg + " — not found"); }
    };

    window.assertNotExists = function(selector, msg) {
        msg = msg || ("Element '" + selector + "' does not exist");
        if (!document.querySelector(selector)) { __pass(msg); }
        else { __fail(msg + " — unexpectedly found"); }
    };

    window.assertText = function(selector, expected, msg) {
        msg = msg || ("'" + selector + "' text equals '" + expected + "'");
        var el = document.querySelector(selector);
        if (!el) { __fail(msg + " — element not found"); return; }
        var actual = el.textContent.trim();
        if (actual === String(expected)) { __pass(msg); }
        else { __fail(msg + " — got '" + actual + "'"); }
    };

    window.assertContainsText = function(selector, expected, msg) {
        msg = msg || ("'" + selector + "' contains '" + expected + "'");
        var el = document.querySelector(selector);
        if (!el) { __fail(msg + " — element not found"); return; }
        if (el.textContent.includes(expected)) { __pass(msg); }
        else { __fail(msg + " — got '" + el.textContent.trim() + "'"); }
    };

    window.assertCount = function(selector, expected, msg) {
        msg = msg || ("'" + selector + "' count equals " + expected);
        var actual = document.querySelectorAll(selector).length;
        if (actual === expected) { __pass(msg); }
        else { __fail(msg + " — got " + actual); }
    };

    window.assertStyle = function(selector, property, expected, msg) {
        msg = msg || ("'" + selector + "' style." + property + " is '" + expected + "'");
        var el = document.querySelector(selector);
        if (!el) { __fail(msg + " — element not found"); return; }
        var actual = window.getComputedStyle(el)[property];
        if (actual === expected) { __pass(msg); }
        else { __fail(msg + " — got '" + actual + "'"); }
    };

    window.assertAttribute = function(selector, attr, expected, msg) {
        msg = msg || ("'" + selector + "' [" + attr + "] is '" + expected + "'");
        var el = document.querySelector(selector);
        if (!el) { __fail(msg + " — element not found"); return; }
        var actual = el.getAttribute(attr);
        if (actual === expected) { __pass(msg); }
        else { __fail(msg + " — got '" + actual + "'"); }
    };

    window.assertEqual = function(actual, expected, msg) {
        msg = msg || ("Expected '" + expected + "'");
        if (actual === expected) { __pass(msg); }
        else { __fail(msg + " — got '" + actual + "'"); }
    };

    window.assertNotEqual = function(actual, expected, msg) {
        msg = msg || ("Expected value not equal to '" + expected + "'");
        if (actual !== expected) { __pass(msg); }
        else { __fail(msg + " — got '" + actual + "'"); }
    };

    window.assertValidHTML = function(msg) {
        msg = msg || "Document has properly nested HTML tags";
        try {
            var html = __rsRawHtmlSource || "";
            var voidTags = new Set([
                "area", "base", "br", "col", "embed", "hr", "img", "input",
                "link", "meta", "param", "source", "track", "wbr",
            ]);
            var validTags = new Set([
                "a", "abbr", "address", "article", "aside", "audio", "b", "base",
                "bdi", "bdo", "blockquote", "body", "br", "button", "canvas",
                "caption", "cite", "code", "col", "colgroup", "data", "datalist",
                "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em",
                "embed", "fieldset", "figcaption", "figure", "footer", "form",
                "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup",
                "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "label",
                "legend", "li", "link", "main", "map", "mark", "menu", "meta",
                "meter", "nav", "noscript", "object", "ol", "optgroup", "option",
                "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby",
                "s", "samp", "script", "search", "section", "select", "slot", "small",
                "source", "span", "strong", "style", "sub", "summary", "sup", "table",
                "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time",
                "title", "tr", "track", "u", "ul", "var", "video", "wbr",
                // Common deprecated tags still seen in instructional content.
                "acronym", "applet", "basefont", "big", "center", "font", "frame",
                "frameset", "marquee", "noframes", "strike", "tt",
                // Common SVG/MathML container/content tags.
                "svg", "g", "path", "circle", "rect", "line", "polyline", "polygon",
                "ellipse", "text", "defs", "lineargradient", "radialgradient", "stop",
                "clippath", "mask", "pattern", "symbol", "use", "view", "math", "mrow",
                "mi", "mn", "mo", "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot",
            ]);

            // Ignore regions where '<' is common text, not markup.
            var sanitized = html
                .replace(/<!--[\\s\\S]*?-->/g, "")
                .replace(/<!DOCTYPE[^>]*>/gi, "")
                .replace(/<!\\[CDATA\\[[\\s\\S]*?\\]\\]>/g, "")
                .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script\\s*>/gi, "")
                .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style\\s*>/gi, "")
                .replace(/<textarea\\b[^>]*>[\\s\\S]*?<\\/textarea\\s*>/gi, "");

            var tagRe = /<\\/?([a-zA-Z][\\w:-]*)(\\s[^>]*?)?>/g;
            var stack = [];
            var match;

            while ((match = tagRe.exec(sanitized)) !== null) {
                var fullTag = match[0];
                var name = match[1].toLowerCase();
                var isClosing = fullTag[1] === "/";
                var isCustomElement = /^[a-z][a-z0-9._-]*-[a-z0-9._-]*$/.test(name);

                if (!validTags.has(name) && !isCustomElement) {
                    __fail(msg + " — invalid tag name <" + (isClosing ? "/" : "") + name + ">"
                    );
                    return;
                }

                if (isClosing) {
                    if (stack.length === 0) {
                        __fail(msg + " — unexpected closing tag </" + name + ">");
                        return;
                    }
                    var openTag = stack.pop();
                    if (openTag.name !== name) {
                        __fail(
                            msg +
                                " — mismatched closing tag </" +
                                name +
                                "> for <" +
                                openTag.name +
                                ">",
                        );
                        return;
                    }
                } else {
                    var isSelfClosing = /\\/\\s*>$/.test(fullTag) || voidTags.has(name);
                    if (!isSelfClosing) {
                        stack.push({ name: name });
                    }
                }
            }

            if (stack.length > 0) {
                var unclosed = stack
                    .slice(-3)
                    .map(function (t) {
                        return "<" + t.name + ">";
                    })
                    .join(", ");
                __fail(msg + " — unclosed tag(s): " + unclosed);
                return;
            }

            __pass(msg);
        } catch (e) {
            __fail(msg + " — " + e.message);
        }
    };
    

    window.__rsRunTests = function() {
        window.parent.postMessage({ type: "rsTestResults", results: __rsResults }, "*");
    };
})();
<\/script>`;
    }

    displayTestResults(results) {
        var passed = results.filter(function (r) {
            return r.pass;
        }).length;
        var total = results.length;
        if (total === 0) return;

        var pct = Math.round((passed / total) * 100);
        this.unit_results = `percent:${pct}:passed:${passed}:failed:${total - passed}`;

        var div = this.testResultsDiv;
        div.innerHTML = "";

        var tbl = document.createElement("table");
        tbl.className = "ac-feedback";
        tbl.style.width = "100%";

        results.forEach(function (r) {
            var tr = document.createElement("tr");
            var td = document.createElement("td");
            td.className =
                "ac-feedback " +
                (r.pass ? "ac-feedback-pass" : "ac-feedback-fail");
            td.textContent = (r.pass ? "✓ " : "✗ ") + r.message;
            tr.appendChild(td);
            tbl.appendChild(tr);
        });

        var summary = document.createElement("p");
        summary.className =
            "ac-feedback " +
            (passed === total ? "ac-feedback-pass" : "ac-feedback-fail");
        summary.style.textAlign = "center";
        summary.style.marginTop = "4px";
        summary.textContent =
            passed +
            " of " +
            total +
            " test" +
            (total !== 1 ? "s" : "") +
            " passed";

        div.appendChild(tbl);
        div.appendChild(summary);
        div.style.display = "block";
    }

    createOutput() {
        var outDiv = document.createElement("div");
        outDiv.classList.add("ac_output");
        this.outDiv = outDiv;
        this.output = document.createElement("iframe");
        this.output.style.backgroundColor = "white";
        this.output.style.position = "relative";
        this.output.style.height = "400px";
        this.output.style.width = "100%";
        outDiv.appendChild(this.output);

        this.testResultsDiv = document.createElement("div");
        this.testResultsDiv.className = "unittest-results";
        this.testResultsDiv.style.display = "none";
        outDiv.appendChild(this.testResultsDiv);

        this.outerDiv.appendChild(outDiv);
        var clearDiv = document.createElement("div");
        clearDiv.style.clear = "both"; // needed to make parent div resize properly
        this.outerDiv.appendChild(clearDiv);
    }

    enableSaveLoad() {
        this.runButton.textContent = t("msg_activecode_render");
    }
}
