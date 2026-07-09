// Tests for the JavaScript and HTML flavors of ActiveCode.
// No jquery-globals import -- these components must work without jQuery.
import { describe, it, expect, beforeEach } from "vitest";
import JSActiveCode from "../js/activecode_js.js";
import HTMLActiveCode from "../js/activecode_html.js";

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
});
