// Characterization tests for the ShortAnswer component. shortanswer.js was
// already free of jQuery when these were written; they guard that state.
// Note: deliberately NO jquery-globals import here -- shortanswer must work
// without jQuery.
import { describe, it, expect, beforeEach, vi } from "vitest";
import ShortAnswer from "../js/shortanswer.js";
import TimedShortAnswer from "../js/timed_shortanswer.js";
import RunestoneBase from "../../common/js/runestonebase.js";

// Book pages provide a [data-component=shortanswer] element whose innerHTML is
// the question text (see the Sphinx/PreTeXt templates).
function makeFixture({
    id = "test_shortanswer_1",
    question = "<p>Explain your reasoning.</p>",
    attrs = "",
} = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="shortanswer" id="${id}" class="journal alert alert-warning" ${attrs}>
          ${question}
        </div>
      </div>`;
    return document.getElementById(id);
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function makeShortAnswer(fixtureOpts = {}, extraOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    const sa = new ShortAnswer({
        orig: orig,
        useRunestoneServices: false,
        ...extraOpts,
    });
    await sa.component_ready_promise;
    await tick();
    return sa;
}

beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("alert", vi.fn());
});

describe("construction", () => {
    it("replaces the original element with a form holding a textarea and save button", async () => {
        const sa = await makeShortAnswer();
        const container = document.getElementById("test_shortanswer_1");
        expect(container).toBe(sa.containerDiv);
        expect(container.querySelector("form").id).toBe(
            "test_shortanswer_1_journal",
        );
        const textarea = container.querySelector("textarea");
        expect(textarea.id).toBe("test_shortanswer_1_solution");
        expect(textarea.placeholder).toBe("Write your answer here");
        expect(container.querySelector("button.btn-success").textContent).toBe(
            "Save",
        );
    });

    it("moves the question content into the fieldset", async () => {
        await makeShortAnswer({ question: "<p id='qmark'>Why?</p>" });
        const legend = document.querySelector(".journal-question");
        expect(legend.querySelector("#qmark").textContent).toBe("Why?");
    });

    it("keeps the original element's classes on the new container", async () => {
        await makeShortAnswer();
        const container = document.getElementById("test_shortanswer_1");
        expect(container.classList.contains("journal")).toBe(true);
        expect(container.classList.contains("alert-warning")).toBe(true);
    });

    it("honors data-placeholder", async () => {
        await makeShortAnswer({ attrs: 'data-placeholder="Type here"' });
        expect(document.querySelector("textarea").placeholder).toBe(
            "Type here",
        );
    });

    it("sets the optional flag from data-optional", async () => {
        const sa = await makeShortAnswer({ attrs: "data-optional" });
        expect(sa.optional).toBe(true);
    });

    it("starts with the feedback div hidden", async () => {
        const sa = await makeShortAnswer();
        expect(sa.feedbackDiv.style.display).toBe("none");
    });

    it("adds a file input when data-attachment is set (student mode)", async () => {
        // getAttachmentName fetches; stub it out.
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: false, statusText: "nope" }),
        );
        const sa = await makeShortAnswer({ attrs: "data-attachment" });
        expect(sa.attachment).toBe(true);
        expect(
            document.getElementById("test_shortanswer_1_fileme").type,
        ).toBe("file");
    });
});

describe("editing feedback", () => {
    it("warns that the answer is unsaved on keydown", async () => {
        const sa = await makeShortAnswer();
        sa.jTextArea.dispatchEvent(
            new KeyboardEvent("keydown", { key: "a", bubbles: true }),
        );
        expect(sa.feedbackDiv.innerHTML).toBe(
            "Your answer has not been saved yet!",
        );
        expect(sa.feedbackDiv.classList.contains("alert-danger")).toBe(true);
    });

    it("shows the autosave message instead when timed", async () => {
        const sa = await makeShortAnswer();
        sa.isTimed = true;
        sa.jTextArea.dispatchEvent(
            new KeyboardEvent("keydown", { key: "a", bubbles: true }),
        );
        expect(sa.feedbackDiv.innerHTML).toBe(
            "Your answer is automatically saved.",
        );
    });

    it("marks the question answered when the textarea changes", async () => {
        const sa = await makeShortAnswer();
        sa.jTextArea.value = "an answer";
        sa.jTextArea.dispatchEvent(new Event("change"));
        expect(sa.isAnswered).toBe(true);
    });
});

describe("saving", () => {
    it("stores the answer in localStorage and logs it on Save", async () => {
        const sa = await makeShortAnswer();
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        sa.jTextArea.value = "my thoughtful answer";
        sa.submitButton.click();
        await tick();
        const stored = JSON.parse(
            localStorage.getItem(sa.localStorageKey()),
        );
        expect(stored.answer).toBe("my thoughtful answer");
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "shortanswer",
                act: "my thoughtful answer",
                answer: "my thoughtful answer",
                div_id: "test_shortanswer_1",
            }),
        );
        expect(sa.feedbackDiv.innerHTML).toBe("Your answer has been saved.");
        expect(sa.feedbackDiv.classList.contains("alert-success")).toBe(true);
        expect(sa.feedbackDiv.style.display).toBe("block");
    });

    it("passes a student id through to the log event when given", async () => {
        const sa = await makeShortAnswer();
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        sa.jTextArea.value = "group answer";
        await sa.logCurrentAnswer("student_42");
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({ sid: "student_42" }),
        );
    });
});

describe("checkLocalStorage", () => {
    it("restores a previously saved answer into the textarea", async () => {
        const first = await makeShortAnswer();
        first.jTextArea.value = "saved before";
        await first.checkCurrentAnswer();
        // A fresh render of the same question picks the answer up.
        const second = await makeShortAnswer();
        expect(second.jTextArea.value).toBe("saved before");
    });

    it("drops malformed stored data", async () => {
        const sa = await makeShortAnswer();
        localStorage.setItem(sa.localStorageKey(), "not json{");
        sa.checkLocalStorage();
        expect(localStorage.getItem(sa.localStorageKey())).toBe(null);
    });

    it("does not restore when grading", async () => {
        const first = await makeShortAnswer();
        first.jTextArea.value = "student work";
        await first.checkCurrentAnswer();
        const second = await makeShortAnswer({}, { graderactive: true });
        expect(second.jTextArea.value).toBe("");
    });
});

describe("restoreAnswers", () => {
    it("fills the textarea and shows the submission timestamp", async () => {
        const sa = await makeShortAnswer();
        const when = new Date("2026-01-15T10:30:00");
        sa.restoreAnswers({ answer: "server answer", timestamp: when });
        expect(sa.jTextArea.value).toBe("server answer");
        const p = document.querySelector(".shortanswer__timestamp");
        expect(p.textContent).toBe(when.toLocaleString());
    });

    it("treats a null answer as empty", async () => {
        const sa = await makeShortAnswer();
        sa.restoreAnswers({ answer: null });
        expect(sa.jTextArea.value).toBe("");
    });

    it("shows score and comment feedback", async () => {
        const sa = await makeShortAnswer();
        sa.restoreAnswers({ answer: "x", score: 4, comment: "good work" });
        expect(sa.feedbackDiv.innerHTML).toBe("Score: 4 -- good work");
        expect(sa.feedbackDiv.style.display).toBe("block");
    });

    it("adds a toggle button that swaps between on-time and late answers", async () => {
        const sa = await makeShortAnswer();
        sa.restoreAnswers({
            answer: "on time",
            timestamp: new Date("2026-01-15T10:30:00"),
            last_answer: "late edit",
            last_timestamp: new Date("2026-01-20T10:30:00"),
        });
        const toggle = sa.buttonDiv.querySelector("button.btn-warning");
        expect(toggle.textContent).toBe("Show Late Answer");
        toggle.click();
        expect(sa.jTextArea.value).toBe("late edit");
        expect(toggle.textContent).toBe("Show on-Time Answer");
        toggle.click();
        expect(sa.jTextArea.value).toBe("on time");
    });
});

describe("renderMath", () => {
    it("renders LaTeX-looking answers into a live region with converted delimiters", async () => {
        const sa = await makeShortAnswer();
        sa.renderMath("The area is $$x^2$$ and $y$");
        const rendered = document.querySelector(
            ".shortanswer__rendered-answer",
        );
        expect(rendered.innerHTML).toContain("\\[ x^2 \\]");
        expect(rendered.innerHTML).toContain("\\( y \\)");
        expect(rendered.getAttribute("aria-live")).toBe("polite");
        expect(sa.rederedAnswerDiv.style.display).toBe("block");
    });

    it("hides the rendered answer again for plain text", async () => {
        const sa = await makeShortAnswer();
        sa.renderMath("has math $x^2$");
        sa.renderMath("plain prose");
        expect(sa.rederedAnswerDiv.style.display).toBe("none");
    });

    it("creates no rendered-answer div for plain text", async () => {
        const sa = await makeShortAnswer();
        sa.renderMath("plain prose");
        expect(document.querySelector(".shortanswer__rendered-answer")).toBe(
            null,
        );
    });
});

describe("disableInteraction", () => {
    it("disables the textarea", async () => {
        const sa = await makeShortAnswer();
        sa.disableInteraction();
        expect(sa.jTextArea.disabled).toBe(true);
    });
});

describe("TimedShortAnswer", () => {
    async function makeTimed() {
        const orig = makeFixture();
        const tsa = new TimedShortAnswer({
            orig: orig,
            useRunestoneServices: false,
            timed: true,
        });
        await tsa.component_ready_promise;
        await tick();
        return tsa;
    }

    it("hides the save button and shows the clock icon", async () => {
        const tsa = await makeTimed();
        expect(tsa.submitButton.style.display).toBe("none");
        expect(document.querySelector(".timeTip img").src).toContain(
            "clock.png",
        );
        expect(tsa.isTimed).toBe(true);
    });

    it("is ignored in grading and can hide its feedback", async () => {
        const tsa = await makeTimed();
        expect(tsa.checkCorrectTimed()).toBe("I");
        tsa.feedbackDiv.style.display = "block";
        tsa.hideFeedback();
        expect(tsa.feedbackDiv.style.display).toBe("none");
    });
});

describe("component factory", () => {
    it("builds the timed variant only when opts.timed is set", async () => {
        const plain = window.component_factory.shortanswer({
            orig: makeFixture({ id: "sa_plain" }),
        });
        expect(plain).toBeInstanceOf(ShortAnswer);
        expect(plain).not.toBeInstanceOf(TimedShortAnswer);
        const timed = window.component_factory.shortanswer({
            orig: makeFixture({ id: "sa_timed" }),
            timed: true,
        });
        expect(timed).toBeInstanceOf(TimedShortAnswer);
    });
});
