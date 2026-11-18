// Tests for the JavaScript and HTML flavors of ActiveCode.
// No jquery-globals import -- these components must work without jQuery.
import { describe, it, expect, beforeEach, vi } from "vitest";
import JSActiveCode from "../js/activecode_js.js";
import HTMLActiveCode from "../js/activecode_html.js";
import LiveCode from "../js/livecode.js";

function makeFixture({ id, code, lang }) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="activecode" id="${id}" class="ac_section">
          <textarea data-lang="${lang}">${code}</textarea>
        </div>
      </div>`;
    return document.getElementById(id);
}

beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
});

describe("JSActiveCode", () => {
    it("runs a JavaScript program and writes to the output", async () => {
        const orig = makeFixture({
            id: "test_js_1",
            code: "writeln('hello from js');\nwriteln(6 * 7);",
            lang: "javascript",
        });
        const ac = new JSActiveCode({ orig, useRunestoneServices: false });
        await ac.runProg();
        expect(ac.errinfo).toBe("success");
        expect(ac.output.textContent).toContain("hello from js");
        expect(ac.output.textContent).toContain("42");
    });

    it("shows an error container for a broken program", async () => {
        const orig = makeFixture({
            id: "test_js_2",
            code: "no_such_function();",
            lang: "javascript",
        });
        const ac = new JSActiveCode({ orig, useRunestoneServices: false });
        await ac.runProg();
        expect(ac.errinfo).not.toBe("success");
        expect(ac.eContainer.className).toContain("error");
        // the message is added after a short screenreader-friendly delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(ac.eContainer.textContent).toContain("no_such_function");
    });
});

describe("HTMLActiveCode", () => {
    it("labels the run button Render and targets an iframe", () => {
        const orig = makeFixture({
            id: "test_html_1",
            code: "&lt;h1&gt;Hello&lt;/h1&gt;",
            lang: "html",
        });
        const ac = new HTMLActiveCode({ orig, useRunestoneServices: false });
        expect(ac.runButton.textContent).toBe("Render");
        expect(ac.output.tagName).toBe("IFRAME");
        // entities were decoded by the textarea parser
        expect(ac.editor.getValue()).toContain("<h1>Hello</h1>");
    });

    it("renders the editor contents into the iframe srcdoc", async () => {
        const orig = makeFixture({
            id: "test_html_2",
            code: "&lt;p&gt;content&lt;/p&gt;",
            lang: "html",
        });
        const ac = new HTMLActiveCode({ orig, useRunestoneServices: false });
        await ac.runProg();
        expect(ac.output.srcdoc).toContain("<p>content</p>");
    });

    it("announces each loaded preview, not the initial blank iframe", async () => {
        const orig = makeFixture({
            id: "test_html_preview",
            code: "&lt;p&gt;content&lt;/p&gt;",
            lang: "html",
        });
        const ac = new HTMLActiveCode({ orig, useRunestoneServices: false });
        ac.manage_scrubber = vi.fn(async () => "True");
        ac.buildProg = vi.fn(async () => "<p>content</p>");
        ac.logCurrentAnswer = vi.fn();
        ac.runCoaches = vi.fn();
        ac.renderFeedback = vi.fn();
        const announce = vi.spyOn(ac, "announceAction");
        let previewDocument = {
            URL: "about:blank",
            readyState: "complete",
        };
        Object.defineProperty(ac.output, "contentDocument", {
            configurable: true,
            get: () => previewDocument,
        });

        ac.output.dispatchEvent(new Event("load"));
        expect(announce).not.toHaveBeenCalled();

        await ac.runButtonHandler();
        ac.output.dispatchEvent(new Event("load"));
        expect(announce).not.toHaveBeenCalled();
        previewDocument = { URL: "about:srcdoc", readyState: "complete" };
        ac.output.dispatchEvent(new Event("load"));
        await vi.waitFor(() =>
            expect(ac.actionStatus.textContent).toBe("Preview loaded."),
        );

        await ac.runButtonHandler();
        expect(ac.actionStatus.textContent).toBe("");
        // A queued load from the previous document must not complete this run.
        ac.output.dispatchEvent(new Event("load"));
        expect(announce).toHaveBeenCalledTimes(1);
        previewDocument = { URL: "about:srcdoc", readyState: "complete" };
        ac.output.dispatchEvent(new Event("load"));
        await vi.waitFor(() =>
            expect(ac.actionStatus.textContent).toBe("Preview loaded."),
        );
        expect(announce).toHaveBeenCalledTimes(2);
    });

    it("does not announce an autorun preview load", async () => {
        const orig = makeFixture({
            id: "test_html_autorun",
            code: "&lt;p&gt;content&lt;/p&gt;",
            lang: "html",
        });
        const ac = new HTMLActiveCode({ orig, useRunestoneServices: false });
        ac.suppressRunAnnouncements = true;
        await ac.runProg();
        Object.defineProperty(ac.output, "contentDocument", {
            configurable: true,
            value: { URL: "about:srcdoc", readyState: "complete" },
        });

        ac.output.dispatchEvent(new Event("load"));
        expect(ac._previewLoadPending).toBe(false);
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(ac.actionStatus.textContent).toBe("");
    });

    it("announces iframe unit-test results when they arrive", async () => {
        const orig = makeFixture({
            id: "test_html_results",
            code: "&lt;p&gt;content&lt;/p&gt;",
            lang: "html",
        });
        const ac = new HTMLActiveCode({ orig, useRunestoneServices: false });
        ac.suffix = "window.assertExists('p');";
        ac.manage_scrubber = vi.fn(async () => "True");
        ac.buildProg = vi.fn(async () => "<p>content</p>");
        await ac.runProg();
        Object.defineProperty(ac.output, "contentDocument", {
            configurable: true,
            value: { URL: "about:srcdoc", readyState: "complete" },
        });
        ac.output.dispatchEvent(new Event("load"));
        expect(ac.actionStatus.textContent).toBe("");

        ac.displayTestResults([{ pass: true, message: "Paragraph exists" }]);

        expect(ac.testResultsDiv.querySelector("caption").textContent).toBe(
            "Unit Test Results",
        );
        await vi.waitFor(() =>
            expect(ac.actionStatus.textContent).toBe(
                "Unit Test Results: ✓ Paragraph exists\n1 of 1 test passed",
            ),
        );
    });
});

describe("LiveCode", () => {
    it("associates the program-input label with its textarea", () => {
        const orig = makeFixture({
            id: "test_live_1",
            code: "int main() {}",
            lang: "c",
        });
        orig.querySelector("textarea").setAttribute(
            "data-stdin",
            "program input",
        );

        const ac = new LiveCode({ orig, useRunestoneServices: false });
        expect(ac.stdin_el.labels[0].getAttribute("for")).toBe(
            "test_live_1_stdin",
        );
        expect(ac.stdin_el.labels[0].outerHTML).toContain(
            'for="test_live_1_stdin"',
        );
        expect(ac.stdin_el.labels).toHaveLength(1);
        expect(ac.stdin_el.labels[0].textContent).toBe("Input for Program");
    });

    it("uses a caption for IO-test results", () => {
        const orig = makeFixture({
            id: "test_live_results",
            code: "int main() {}",
            lang: "cpp",
        });
        const ac = new LiveCode({ orig, useRunestoneServices: false });
        ac.processJobeIOResponses([
            {
                stdout: "answer\n",
                test: { input: "question", out: "answer\n" },
                outcome: 15,
            },
        ]);
        ac.renderFeedback();

        const results = ac.outerDiv.querySelector(".unittest-results");
        expect(results.querySelector("caption").textContent).toBe(
            "Unit Test Results",
        );
        expect(
            results.querySelectorAll(".unittest-results__heading"),
        ).toHaveLength(1);
    });
});
