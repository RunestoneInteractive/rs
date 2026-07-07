// Characterization tests for the ActiveCode component. These describe the
// behavior of the component as observed on a book page. Note: deliberately
// NO jquery-globals import here -- activecode must work without jQuery.
import { describe, it, expect, beforeEach } from "vitest";
import { ActiveCode } from "../js/activecode.js";

// Build the same DOM a book page provides: a div.runestone wrapper around the
// [data-component=activecode] div containing a textarea with the starter code.
function makeFixture({
    id = "test_ac_1",
    code = "print('hello world')",
    lang = "python",
    attrs = "",
    question = "",
} = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="activecode" id="${id}" class="ac_section">
          ${question}
          <textarea data-lang="${lang}" ${attrs}>${code}</textarea>
        </div>
      </div>`;
    return document.getElementById(id);
}

function makeActiveCode(fixtureOpts = {}, acOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    return new ActiveCode({
        orig: orig,
        useRunestoneServices: false,
        python3: true,
        ...acOpts,
    });
}

beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
});

describe("construction", () => {
    it("creates a CodeMirror editor holding the starter code", () => {
        const ac = makeActiveCode({ code: "x = 40 + 2\nprint(x)" });
        expect(ac.divid).toBe("test_ac_1");
        expect(ac.language).toBe("python");
        expect(ac.editor.getValue()).toBe("x = 40 + 2\nprint(x)");
        // The editor lives inside the component's outer div.
        expect(ac.outerDiv.querySelector(".CodeMirror")).toBeTruthy();
        expect(ac.codeDiv.classList.contains("ac_code_div")).toBe(true);
    });

    it("marks the component ready on the container div", () => {
        const ac = makeActiveCode();
        expect(
            ac.containerDiv.classList.contains("runestone-component-ready"),
        ).toBe(true);
        return ac.component_ready_promise;
    });

    it("adds a caption below the component", () => {
        const ac = makeActiveCode();
        const cap = ac.containerDiv.querySelector("p.runestone_caption");
        expect(cap).toBeTruthy();
        expect(cap.textContent).toContain("ActiveCode");
    });

    it("registers itself for the CSS status decoration", () => {
        const ac = makeActiveCode();
        const rsDiv = ac.containerDiv.closest("div.runestone");
        expect(rsDiv.classList.contains("notAnswered")).toBe(true);
    });
});

describe("data attribute parsing", () => {
    it("coerces numeric attributes the way jQuery .data() did", () => {
        const ac = makeActiveCode({ attrs: 'data-timelimit="30000"' });
        expect(ac.timelimit).toBe(30000);
    });

    it("splits data-include on whitespace", () => {
        const ac = makeActiveCode({ attrs: 'data-include="inc_1 inc_2"' });
        expect(ac.includes).toEqual(["inc_1", "inc_2"]);
    });

    it("keeps parsonsPersonalized true unless explicitly false", () => {
        let ac = makeActiveCode();
        expect(ac.parsonsPersonalized).toBe(true);
        ac = makeActiveCode({
            id: "test_ac_2",
            attrs: 'data-parsons-personalized="false"',
        });
        expect(ac.parsonsPersonalized).toBe(false);
    });
});

describe("prefix/suffix handling", () => {
    it("strips an invisible suffix (====) from the editor and stores it", () => {
        const ac = makeActiveCode({
            code: "print('visible')\n====\nprint('hidden test')\n",
        });
        expect(ac.editor.getValue()).toBe("print('visible')\n");
        expect(ac.suffix).toBe("print('hidden test')\n");
    });

    it("strips an invisible prefix (^^^^) from the editor and stores it", () => {
        const ac = makeActiveCode({
            code: "print('hidden setup')\n^^^^\nprint('visible')\n",
        });
        expect(ac.editor.getValue()).toBe("print('visible')\n");
        expect(ac.prefix).toBe("print('hidden setup')\n");
    });

    it("keeps a visible suffix (===!) in the editor, marked read-only", () => {
        const ac = makeActiveCode({
            code: "print('editable')\n===!\nprint('locked')\n",
        });
        expect(ac.editor.getValue()).toBe(
            "print('editable')\nprint('locked')\n",
        );
        expect(ac.visibleSuffix).toBe("print('locked')\n");
        expect(ac.lockTextMarkers.length).toBeGreaterThan(0);
    });

    it("assembles prefix + editor + suffix in buildProg", async () => {
        const ac = makeActiveCode({
            code: "setup()\n^^^^\nuser_code()\n====\ntests()\n",
        });
        const prog = await ac.buildProg(true);
        expect(prog).toBe("setup()\nuser_code()\n\ntests()\n");
    });
});

describe("controls", () => {
    it("creates a Run button wired to the runButtonHandler", () => {
        const ac = makeActiveCode();
        expect(ac.runButton).toBeTruthy();
        expect(ac.runButton.textContent).toBe("Run");
        expect(ac.runButton.title).toBe("Save & Run (ctrl-s)");
        expect(ac.runButton.getAttribute("type")).toBe("button");
        expect(ac.runButton.classList.contains("run-button")).toBe(true);
        expect(ac.controlDiv.classList.contains("ac_actions")).toBe(true);
    });

    it("adds a Download button when data-enabledownload is set", () => {
        const ac = makeActiveCode({ attrs: "data-enabledownload" });
        expect(ac.downloadButton).toBeTruthy();
        expect(ac.downloadButton.textContent).toBe("Download");
    });

    it("adds a Reformat button only for curly-brace languages", () => {
        let ac = makeActiveCode();
        expect(ac.reformatButton).toBeUndefined();
        // livecode langs construct LiveCode normally; ActiveCode still honors
        // the reformatable set for e.g. javascript
        ac = makeActiveCode({ id: "test_ac_2", lang: "javascript" });
        expect(ac.reformatButton).toBeTruthy();
    });

    it("relabels the Run button when save/load is enabled", () => {
        const ac = makeActiveCode();
        ac.enableSaveLoad();
        expect(ac.runButton.textContent).toBe("Save & Run");
    });
});

describe("hidecode", () => {
    it("hides the editor and shows a Show Code button", () => {
        const ac = makeActiveCode({ attrs: 'data-hidecode="true"' });
        expect(ac.codeDiv.style.display).toBe("none");
        expect(ac.showHideButt).toBeTruthy();
        expect(ac.showHideButt.textContent).toBe("Show Code");
        expect(ac.runButton.disabled).toBe(true);
    });

    it("toggles editor visibility and run button on click", () => {
        const ac = makeActiveCode({ attrs: 'data-hidecode="true"' });
        ac.showHideButt.click();
        expect(ac.codeDiv.style.display).not.toBe("none");
        expect(ac.showHideButt.textContent).toBe("Hide Code");
        expect(ac.runButton.disabled).toBe(false);
        ac.showHideButt.click();
        expect(ac.codeDiv.style.display).toBe("none");
        expect(ac.showHideButt.textContent).toBe("Show Code");
        expect(ac.runButton.disabled).toBe(true);
    });
});

describe("output area", () => {
    it("creates stdout, graphics, coach, codelens and error containers", () => {
        const ac = makeActiveCode();
        expect(ac.output.id).toBe("test_ac_1_stdout");
        expect(ac.output.getAttribute("role")).toBe("log");
        expect(ac.graphics.id).toBe("test_ac_1_graphics");
        expect(ac.codecoach.style.display).toBe("none");
        expect(ac.codelens.style.display).toBe("none");
        expect(ac.eContainer.id).toBe("test_ac_1_errinfo");
        expect(ac.eContainer.style.visibility).toBe("hidden");
    });
});

describe("running python with skulpt", () => {
    it("runs the program and writes escaped output to the stdout pre", async () => {
        const ac = makeActiveCode({
            code: "print('2 < 3')\nprint('done')",
        });
        await ac.runProg();
        expect(ac.errinfo).toBe("success");
        // stdout writes are appended from 1ms timeouts; let them flush
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(ac.output.innerHTML).toContain("2 &lt; 3");
        expect(ac.output.textContent).toContain("done");
    });

    it("reports errors in the error container", async () => {
        const ac = makeActiveCode({
            id: "test_ac_err",
            code: "print(undefined_name)",
        });
        await ac.runProg();
        expect(ac.errinfo).toContain("NameError");
        expect(ac.eContainer.style.visibility).toBe("visible");
        // the detailed message is added on a timeout
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(ac.eContainer.textContent).toContain("Error");
    });

    it("records history when the code changed", async () => {
        const ac = makeActiveCode({ code: "print('one')" });
        ac.editor.setValue("print('two')");
        const before = ac.history.length;
        await ac.runProg();
        expect(ac.history.length).toBe(before + 1);
        expect(ac.history[ac.history.length - 1]).toBe("print('two')");
    });
});

describe("error message formatting", () => {
    it("names the error and offers a description and fix", () => {
        const ac = makeActiveCode();
        ac.pretextLines = 0;
        ac.progLines = 100;
        ac.addErrorMessage(new Error("NameError: name 'x' is not defined"));
        const text = ac.eContainer.textContent;
        expect(text).toContain("Error");
        expect(text).toContain("Description");
        expect(text).toContain("To Fix");
        expect(text).toContain("NameError: name 'x' is not defined");
    });
});

describe("history scrubber", () => {
    it("builds a range-input scrubber after the run button", async () => {
        const ac = makeActiveCode();
        await ac.addHistoryScrubber(true);
        expect(ac.historyScrubber).toBeTruthy();
        expect(ac.historyScrubber.tagName).toBe("INPUT");
        expect(ac.historyScrubber.type).toBe("range");
        expect(ac.historyScrubber.getAttribute("aria-label")).toBe(
            "History slider",
        );
        expect(ac.timestampP.textContent).toContain("1 of 1");
    });

    it("restores older code when the scrubber moves", async () => {
        const ac = makeActiveCode({ code: "print('v1')" });
        ac.editor.setValue("print('v2')");
        await ac.manage_scrubber("False");
        expect(ac.history).toEqual(["print('v1')", "print('v2')"]);
        expect(ac.timestampP.textContent).toContain("2 of 2");
        // drag back to the first revision
        ac.historyScrubber.value = 0;
        ac.historyScrubber.dispatchEvent(new Event("input"));
        expect(ac.editor.getValue()).toBe("print('v1')");
        expect(ac.timestampP.textContent).toContain("1 of 2");
    });
});

describe("resizable editor", () => {
    it("tags the CodeMirror wrapper with the ac-resizable class", () => {
        const ac = makeActiveCode();
        expect(
            ac.editor.getWrapperElement().classList.contains("ac-resizable"),
        ).toBe(true);
    });
});

describe("disableInteraction", () => {
    it("hides the run button and disables the editor area", () => {
        const ac = makeActiveCode();
        ac.disableInteraction();
        expect(ac.runButton.style.display).toBe("none");
        expect(ac.codeDiv.classList.contains("ac-disabled")).toBe(true);
    });
});
