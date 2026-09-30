// Characterization tests for the ActiveCode component. These describe the
// behavior of the component as observed on a book page. Note: deliberately
// NO jquery-globals import here -- activecode must work without jQuery.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ActiveCode } from "../js/activecode.js";

// Build the same DOM a book page provides: a div.runestone wrapper around the
// [data-component=activecode] div containing a textarea with the starter code.
function makeFixture({
    id = "test_ac_1",
    code = "print('hello world')",
    lang = "python",
    attrs = "",
    question = "",
    contextHeadingLevel = null,
} = {}) {
    const component = `
      <div class="runestone">
        <div data-component="activecode" id="${id}" class="ac_section">
          ${question}
          <textarea data-lang="${lang}" ${attrs}>${code}</textarea>
        </div>
      </div>`;
    document.body.innerHTML = contextHeadingLevel
        ? `<section><h${contextHeadingLevel}>Section title</h${contextHeadingLevel}>${component}</section>`
        : component;
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

    it("puts generated headings below the containing authored heading", () => {
        let ac = makeActiveCode({ contextHeadingLevel: 1 });
        expect(ac.codecoach.querySelector("h2")?.textContent).toBe(
            "Code Coach",
        );

        ac = makeActiveCode({ id: "test_ac_2", contextHeadingLevel: 4 });
        expect(ac.codecoach.querySelector("h5")?.textContent).toBe(
            "Code Coach",
        );
    });

    it("caps generated heading levels at h6", () => {
        const ac = makeActiveCode({ contextHeadingLevel: 6 });
        expect(ac.codecoach.querySelector("h6")?.textContent).toBe(
            "Code Coach",
        );
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
        expect(ac.actionStatus.getAttribute("role")).toBe("status");
        expect(ac.actionStatus.classList.contains("visuallyhidden")).toBe(true);
        expect(ac.actionStatus.getAttribute("aria-live")).toBe("polite");
        expect(ac.actionStatus.getAttribute("aria-atomic")).toBe("true");
    });

    it.each([
        [
            "Ctrl-S in the editor",
            { key: "s", code: "KeyS", ctrlKey: true },
            "editor",
        ],
        ["Meta-S without event.code", { key: "s", metaKey: true }, "editor"],
        [
            "Ctrl-S on a control",
            { key: "s", code: "KeyS", ctrlKey: true },
            "control",
        ],
    ])("uses the Run button click path for %s", async (_, keys, target) => {
        const ac = makeActiveCode({ code: "print(42)" });
        ac.logCurrentAnswer = vi.fn();
        ac.runCoaches = vi.fn();
        ac.renderFeedback = vi.fn();
        const onClick = vi.fn();
        ac.runButton.addEventListener("click", onClick);

        const event = new KeyboardEvent("keydown", {
            ...keys,
            bubbles: true,
            cancelable: true,
        });
        const source =
            target === "editor" ? ac.editor.getInputField() : ac.runButton;
        source.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(onClick).toHaveBeenCalledTimes(1);
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(ac.runCount).toBe(1);
        expect(ac.logCurrentAnswer).toHaveBeenCalledTimes(1);
        expect(ac.runCoaches).toHaveBeenCalledTimes(1);
        expect(ac.renderFeedback).toHaveBeenCalledTimes(1);
        expect(ac.actionStatus.textContent).toBe("Program output: 42");
    });

    it("adds a Download button when data-enabledownload is set", () => {
        const ac = makeActiveCode({ attrs: "data-enabledownload" });
        expect(ac.downloadButton).toBeTruthy();
        expect(ac.downloadButton.textContent).toBe("Download");
    });

    it("announces when code is downloaded", async () => {
        const ac = makeActiveCode({ attrs: "data-enabledownload" });
        ac.downloadFile = vi.fn();

        ac.downloadButton.click();
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(ac.downloadFile).toHaveBeenCalledWith("python");
        expect(ac.actionStatus.textContent).toBe("Code downloaded.");
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

    it("announces when code is reformatted", async () => {
        const ac = makeActiveCode({ lang: "javascript" });

        ac.reformatButton.click();
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(ac.actionStatus.textContent).toBe("Code reformatted.");
    });

    it("associates labels with both pair-programming controls", () => {
        const ac = makeActiveCode();
        const controls = document.createElement("div");
        ac.setupPartner(controls);
        const [checkbox, partner] = controls.querySelectorAll("input");

        expect(checkbox.labels[0].getAttribute("for")).toBe(checkbox.id);
        expect(checkbox.labels[0].textContent).toBe("Pair?");
        expect(partner.labels[0].getAttribute("for")).toBe(partner.id);
        expect(partner.labels[0].textContent).toBe("With:");
    });
});

describe("the question statement", () => {
    const statement = (id) =>
        `<div id="${id}_question" class="ac_question"><p>Set result to 42.</p></div>`;

    it("moves the statement to the top of the component", () => {
        const ac = makeActiveCode({ question: statement("test_ac_1") });
        expect(ac.outerDiv.firstChild).toBe(ac.question);
        expect(ac.containerDiv.querySelectorAll(".ac_question").length).toBe(1);
    });

    it("drops a statement that is only whitespace", () => {
        const ac = makeActiveCode({
            question:
                '<div id="test_ac_1_question" class="ac_question"> </div>',
        });
        expect(ac.containerDiv.querySelector(".ac_question")).toBeNull();
    });

    // #1328: a toggle question renders the same activecode in its preview panel
    // and again in place. Looking the statement up globally found the *other*
    // copy and moved it here, so the statement showed twice.
    it("ignores a same-divid statement elsewhere in the document", () => {
        document.body.innerHTML = `
          <div id="toggle-preview">
            <div class="runestone">
              <div data-component="activecode" id="dup_ac" class="ac_section">
                ${statement("dup_ac")}
                <textarea data-lang="python">x = 0</textarea>
              </div>
            </div>
          </div>
          <div id="sel-toggleSelectedQuestion">
            <div class="runestone">
              <div data-component="activecode" id="dup_ac" class="ac_section">
                ${statement("dup_ac")}
                <textarea data-lang="python">x = 0</textarea>
              </div>
            </div>
          </div>`;
        const preview = document.getElementById("toggle-preview");
        const inPlace = document.getElementById("sel-toggleSelectedQuestion");
        const ac = new ActiveCode({
            orig: inPlace.querySelector("[data-component=activecode]"),
            useRunestoneServices: false,
            python3: true,
        });
        expect(ac.containerDiv.querySelectorAll(".ac_question").length).toBe(1);
        expect(ac.outerDiv.firstChild).toBe(ac.question);
        // the preview copy is left where it was
        expect(preview.querySelectorAll(".ac_question").length).toBe(1);
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
        expect(ac.output.getAttribute("role")).toBeNull();
        expect(ac.output.getAttribute("aria-live")).toBeNull();
        expect(ac.output.getAttribute("aria-atomic")).toBeNull();
        expect(ac.output.getAttribute("aria-label")).toBeNull();
        expect(ac.graphics.id).toBe("test_ac_1_graphics");
        expect(ac.codecoach.style.display).toBe("none");
        expect(ac.codelens.style.display).toBe("none");
        expect(ac.eContainer.id).toBe("test_ac_1_errinfo");
        expect(ac.eContainer.style.visibility).toBe("hidden");
    });

    it("announces the first output through the separate status only", async () => {
        const ac = makeActiveCode();
        expect(ac.outDiv.classList.contains("ac_output--collapsed")).toBe(true);
        expect(ac.outDiv.style.visibility).toBe("");
        expect(ac.actionStatus.isConnected).toBe(true);

        ac.runProg = vi.fn(async () => {
            expect(ac.outDiv.classList.contains("ac_output--collapsed")).toBe(
                false,
            );
            ac.output.textContent = "first output";
        });
        ac.logCurrentAnswer = vi.fn();
        ac.runCoaches = vi.fn();
        ac.renderFeedback = vi.fn();

        await ac.runButtonHandler();

        expect(ac.output.textContent).toBe("first output");
        await vi.waitFor(() =>
            expect(ac.actionStatus.textContent).toBe(
                "Program output: first output",
            ),
        );
    });

    it("captions and announces complete unit results on every run", async () => {
        const ac = makeActiveCode();
        ac.runProg = vi.fn(async () => {
            ac.output.textContent = "42";
            ac.errinfo = "success";
        });
        ac.logCurrentAnswer = vi.fn();
        ac.runCoaches = vi.fn();
        ac.renderFeedback = vi.fn(() => {
            if (ac.outerDiv.querySelector(".unittest-results")) return;
            const results = document.createElement("div");
            results.className = "unittest-results";
            results.innerHTML =
                "<table><tr><th>Result</th><th>Notes</th></tr>" +
                "<tr><td>Passed</td><td>answer is 42</td></tr></table>" +
                "<p>1 of 1 passed</p>";
            ac.outerDiv.appendChild(results);
        });

        for (let run = 0; run < 2; run++) {
            await ac.runButtonHandler();
            await vi.waitFor(() =>
                expect(ac.actionStatus.textContent).toBe(
                    "Program output: 42\n" +
                        "Unit Test Results: Result, Notes\n" +
                        "Passed, answer is 42\n1 of 1 passed",
                ),
            );
            const results = ac.outerDiv.querySelector(".unittest-results");
            expect(results.querySelectorAll("caption")).toHaveLength(1);
            expect(results.querySelector("caption").textContent).toBe(
                "Unit Test Results",
            );
            expect(results.hasAttribute("aria-live")).toBe(false);
        }
    });

    it("keeps autorun unit results silent while still captioning the table", async () => {
        const ac = makeActiveCode();
        const results = document.createElement("div");
        results.className = "unittest-results";
        results.innerHTML = "<table><tr><td>Passed</td></tr></table>";
        ac.outerDiv.appendChild(results);
        ac.suppressRunAnnouncements = true;

        ac.announceProgramOutput();
        expect(results.querySelector("caption").textContent).toBe(
            "Unit Test Results",
        );
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(ac.actionStatus.textContent).toBe("");
    });

    it("keeps page-load autorun silent but announces a later click", async () => {
        const ac = makeActiveCode({ attrs: 'data-autorun="true"' });
        let finishAutorun;
        ac.runProg = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        finishAutorun = () => {
                            ac.output.textContent = "initial output";
                            resolve();
                        };
                    }),
            )
            .mockImplementationOnce(async () => {
                ac.output.textContent = "clicked output";
            });
        ac.logCurrentAnswer = vi.fn();
        ac.runCoaches = vi.fn();
        ac.renderFeedback = vi.fn();

        await vi.waitFor(() => expect(ac.runInProgress).toBe(true));
        await new Promise((resolve) => setTimeout(resolve, 170));
        expect(ac.actionStatus.textContent).toBe("");
        expect(ac.actionStatus.getAttribute("aria-live")).toBe("off");
        expect(ac.codecoach.getAttribute("aria-live")).toBe("off");
        expect(ac.eContainer.getAttribute("aria-live")).toBe("off");

        finishAutorun();
        await vi.waitFor(() => expect(ac.runCount).toBe(1));
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(ac.output.textContent).toBe("initial output");
        expect(ac.actionStatus.textContent).toBe("");

        // A coach can add its own region after the autorun handler finishes.
        const lateCoach = document.createElement("div");
        lateCoach.setAttribute("role", "log");
        lateCoach.setAttribute("aria-live", "polite");
        lateCoach.textContent = "late coach feedback";
        ac.outerDiv.appendChild(lateCoach);
        const implicitLog = document.createElement("div");
        implicitLog.setAttribute("role", "log");
        ac.outerDiv.appendChild(implicitLog);
        await vi.waitFor(() =>
            expect(lateCoach.getAttribute("aria-live")).toBe("off"),
        );
        expect(implicitLog.getAttribute("aria-live")).toBe("off");

        ac.runButton.click();
        expect(ac.actionStatus.getAttribute("aria-live")).toBe("polite");
        expect(ac.codecoach.getAttribute("aria-live")).toBe("polite");
        expect(ac.eContainer.getAttribute("aria-live")).toBe("polite");
        expect(lateCoach.getAttribute("aria-live")).toBe("polite");
        expect(implicitLog.hasAttribute("aria-live")).toBe(false);
        await vi.waitFor(() =>
            expect(ac.actionStatus.textContent).toBe(
                "Program output: clicked output",
            ),
        );
    });

    it("suppresses an autorun result delivered after the handler returns", async () => {
        const ac = makeActiveCode({ attrs: 'data-autorun="true"' });
        ac.announcesOutputOnResult = true;
        ac.runProg = vi.fn(async () => {
            ac.output.textContent = "delayed output";
        });
        ac.logCurrentAnswer = vi.fn();
        ac.runCoaches = vi.fn();
        ac.renderFeedback = vi.fn();

        await vi.waitFor(() => expect(ac.runCount).toBe(1));
        expect(ac.suppressRunAnnouncements).toBe(true);
        ac.announceProgramOutput();
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(ac.actionStatus.textContent).toBe("");
        expect(ac.suppressRunAnnouncements).toBe(true);

        ac.runButton.click();
        expect(ac.suppressRunAnnouncements).toBe(false);
        await vi.waitFor(() => expect(ac.runCount).toBe(2));
        ac.announceProgramOutput();
        await vi.waitFor(() =>
            expect(ac.actionStatus.textContent).toBe(
                "Program output: delayed output",
            ),
        );
    });

    it("keeps Run focused and announces a slow run without allowing a second run", async () => {
        const ac = makeActiveCode();
        let finishRun;
        ac.runProg = vi.fn(
            () =>
                new Promise((resolve) => {
                    finishRun = resolve;
                }),
        );
        ac.logCurrentAnswer = vi.fn();
        ac.runCoaches = vi.fn();
        ac.renderFeedback = vi.fn();
        ac.runButton.focus();

        const firstRun = ac.runButtonHandler();
        await ac.runButtonHandler();

        expect(ac.runProg).toHaveBeenCalledTimes(1);
        expect(ac.runButton.disabled).toBe(false);
        expect(document.activeElement).toBe(ac.runButton);
        await new Promise((resolve) => setTimeout(resolve, 170));
        expect(ac.actionStatus.textContent).toBe("Running program.");

        finishRun();
        await firstRun;
        expect(ac.actionStatus.textContent).toBe("");
        expect(ac.runInProgress).toBe(false);
    });

    it("distinguishes repeated output from no output on consecutive runs", async () => {
        const ac = makeActiveCode({ code: "print(42)" });
        ac.logCurrentAnswer = vi.fn();
        ac.runCoaches = vi.fn();
        ac.renderFeedback = vi.fn();

        await ac.runButtonHandler();
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(ac.actionStatus.textContent).toBe("Program output: 42");

        const secondRun = ac.runButtonHandler();
        expect(ac.actionStatus.textContent).toBe("");
        await secondRun;
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(ac.actionStatus.textContent).toBe("Program output: 42");

        ac.editor.setValue("pass");
        await ac.runButtonHandler();
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(ac.actionStatus.textContent).toBe(
            "Program finished. No output.",
        );
        expect(ac.runCount).toBe(3);
    });

    it("announces successful runs that produce no output", async () => {
        const ac = makeActiveCode({ code: "value = 42" });
        ac.logCurrentAnswer = vi.fn();
        ac.runCoaches = vi.fn();
        ac.renderFeedback = vi.fn();

        await ac.runButtonHandler();
        await new Promise((resolve) => setTimeout(resolve, 40));

        expect(ac.errinfo).toBe("success");
        expect(ac.output.textContent).toBe("");
        expect(ac.actionStatus.textContent).toBe(
            "Program finished. No output.",
        );
    });

    it("includes a delayed program error in the completed readback", async () => {
        const ac = makeActiveCode({ code: "print(undefined_name)" });
        ac.logCurrentAnswer = vi.fn();
        ac.runCoaches = vi.fn();
        ac.renderFeedback = vi.fn();

        await ac.runButtonHandler();
        await new Promise((resolve) => setTimeout(resolve, 40));

        expect(ac.actionStatus.textContent).toContain("Program output:");
        expect(ac.actionStatus.textContent).toContain("NameError");
    });
});

describe("running python with skulpt", () => {
    it("runs the program and writes escaped output to the stdout pre", async () => {
        const ac = makeActiveCode({
            code: "print('2 < 3')\nprint('done')",
        });
        await ac.runProg();
        expect(ac.errinfo).toBe("success");
        // stdout writes land synchronously -- no flush wait needed. See #475.
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

describe("print and input stay in order (#475)", () => {
    // Two things had to be true for a program that mixes print() and input()
    // to read correctly.  Skulpt's file.write discards whatever Sk.output
    // returns, so outputfun must not defer its DOM write; and input() must
    // suspend the interpreter -- which it only does when inputfun returns a
    // thenable -- so the browser gets to paint before the student is asked.
    function inputField(ac) {
        return ac.output.querySelector(".ac-input-field");
    }

    // The interpreter is suspended while a widget is up, so drive it the way a
    // student would: wait for the field, type, press Enter.
    function waitForInputField(ac, timeout = 2000) {
        return new Promise((resolve, reject) => {
            const deadline = Date.now() + timeout;
            const check = () => {
                const field = inputField(ac);

                if (field) {
                    resolve(field);
                } else if (Date.now() > deadline) {
                    reject(new Error("no input field appeared"));
                } else {
                    setTimeout(check, 5);
                }
            };

            check();
        });
    }

    async function answer(ac, value) {
        const field = await waitForInputField(ac);

        field.value = value;
        field.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
    }

    it("writes output synchronously rather than returning a suspension", () => {
        const ac = makeActiveCode();
        const result = ac.outputfun("hello\n");

        // observable immediately, with no timer flush
        expect(ac.output.innerHTML).toBe("hello<br>");
        expect(result).toBeUndefined();
    });

    it("returns a thenable from inputfun so skulpt suspends on it", async () => {
        // Skulpt only builds a Suspension when inputfun returns a thenable
        // (Sk.builtin.file.$readline).  Returning a plain value would run
        // straight through and never yield to the browser.
        const ac = makeActiveCode();
        const pending = ac.inputfun("q");

        expect(typeof pending.then).toBe("function");
        await answer(ac, "42");
        await expect(pending).resolves.toBe("42");
    });

    it("asks for input inline in the output pane, not through window.prompt", async () => {
        const ac = makeActiveCode();
        const orig = window.prompt;
        let promptCalls = 0;

        window.prompt = () => {
            promptCalls += 1;
            return "";
        };
        try {
            const pending = ac.inputfun("Guess the number:");
            const field = inputField(ac);

            expect(field).not.toBeNull();
            // inside the output pane, so it sits with the text it belongs to
            expect(ac.output.contains(field)).toBe(true);
            expect(document.activeElement).toBe(field);
            expect(promptCalls).toBe(0);

            // the prompt names the field, so screen readers announce it
            const label = ac.output.querySelector(".ac-input-prompt");

            expect(label.textContent).toBe("Guess the number:");
            expect(label.getAttribute("for")).toBe(field.id);

            await answer(ac, "7");
            await pending;
        } finally {
            window.prompt = orig;
        }
    });

    it("echoes the prompt and answer, then clears the widget", async () => {
        const ac = makeActiveCode();
        const pending = ac.inputfun("Name? ");

        await answer(ac, "Ada");
        await expect(pending).resolves.toBe("Ada");
        expect(inputField(ac)).toBeNull();
        // the transcript still reads top to bottom afterwards
        expect(ac.output.textContent).toContain("Name? Ada");
    });

    it("submits with the button as well as the Enter key", async () => {
        const ac = makeActiveCode();
        const pending = ac.inputfun("q");
        const field = await waitForInputField(ac);

        field.value = "clicked";
        ac.output.querySelector(".ac-input-submit").click();
        await expect(pending).resolves.toBe("clicked");
    });

    it("treats Escape as an empty line so a stuck program can be let go", async () => {
        const ac = makeActiveCode();
        const pending = ac.inputfun("q");
        const field = await waitForInputField(ac);

        field.value = "ignored";
        field.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        await expect(pending).resolves.toBe("");
    });

    it("gives an unprompted input() an accessible name anyway", async () => {
        const ac = makeActiveCode();
        const pending = ac.inputfun("");

        expect(
            ac.output.querySelector(".ac-input-prompt").textContent,
        ).not.toBe("");
        await answer(ac, "x");
        await pending;
    });

    it("hands the promise-returning inputfun to skulpt", async () => {
        // Guards the Sk.configure wiring: without it skulpt falls back to its
        // own synchronous window.prompt and none of the above applies.
        const ac = makeActiveCode({ id: "test_ac_cfg", code: "print('hi')" });

        await ac.runProg();
        const res = window.Sk.inputfun("q");

        expect(typeof res.then).toBe("function");
        await answer(ac, "x");
        await res;
    });

    it("clears a pending input widget when the program is run again", async () => {
        const ac = makeActiveCode();

        ac.inputfun("q");
        expect(inputField(ac)).not.toBeNull();
        await ac.runProg();
        expect(inputField(ac)).toBeNull();
    });

    it("shows each print before the input prompt that follows it", async () => {
        const ac = makeActiveCode({
            id: "test_ac_io",
            code: [
                "for i in range(2):",
                "    print('before', i)",
                "    answer = input('prompt ' + str(i))",
            ].join("\n"),
        });
        const seenAtPrompt = [];
        const running = ac.runProg();

        for (const value of ["x", "y"]) {
            await waitForInputField(ac);
            // what the student can read at the moment they are asked
            seenAtPrompt.push({
                label: ac.output.querySelector(".ac-input-prompt").textContent,
                dom: ac.output.textContent,
            });
            await answer(ac, value);
        }
        await running;

        expect(seenAtPrompt.map((s) => s.label)).toEqual([
            "prompt 0",
            "prompt 1",
        ]);
        expect(seenAtPrompt[0].dom).toContain("before 0");
        expect(seenAtPrompt[1].dom).toContain("before 1");
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
        expect(ac.historyScrubber.min).toBe("1");
        expect(ac.historyScrubber.max).toBe("1");
        expect(ac.timestampP.textContent).toBe("Original - 1 of 1");
        expect(ac.historyScrubber.value).toBe("1");
        expect(ac.historyScrubber.getAttribute("aria-valuetext")).toBe(
            ac.timestampP.textContent,
        );
    });

    it("starts on the latest revision when requested", () => {
        const ac = makeActiveCode({ code: "print('v1')" });
        ac.history.push("print('v2')");
        ac.timestamps.push("Saved revision");

        ac.renderScrubber(true);

        expect(ac.historyScrubber.value).toBe("2");
        expect(ac.editor.getValue()).toBe("print('v2')");
        expect(ac.timestampP.textContent).toBe("Saved revision - 2 of 2");
        expect(ac.historyScrubber.getAttribute("aria-valuetext")).toBe(
            ac.timestampP.textContent,
        );
    });

    it("restores older code when the scrubber moves", async () => {
        const ac = makeActiveCode({ code: "print('v1')" });
        ac.editor.setValue("print('v2')");
        await ac.manage_scrubber("False");
        expect(ac.history).toEqual(["print('v1')", "print('v2')"]);
        expect(ac.historyScrubber.max).toBe("2");
        expect(ac.historyScrubber.value).toBe("2");
        expect(ac.timestampP.textContent).toContain("2 of 2");
        expect(ac.historyScrubber.getAttribute("aria-valuetext")).toBe(
            ac.timestampP.textContent,
        );
        // drag back to the first revision
        ac.historyScrubber.value = 1;
        ac.historyScrubber.dispatchEvent(new Event("input"));
        expect(ac.editor.getValue()).toBe("print('v1')");
        expect(ac.timestampP.textContent).toContain("1 of 2");
        expect(ac.historyScrubber.getAttribute("aria-valuetext")).toBe(
            ac.timestampP.textContent,
        );
        expect(ac.computeEditDistance()).toBe(0);
        await ac.manage_scrubber("False");
        expect(ac.history).toHaveLength(2);
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
