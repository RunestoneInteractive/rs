// Screen reader tests for the fill-in-the-blank component.
//
// The blanks used to be named "input area", which is all a screen reader
// announces when focus lands on one: the prompt around the field is never read
// in forms mode, so tabbing into a question said nothing about the question.
// These tests pin the accessible names, the grading state exposed on each
// blank, and the wording of the feedback.
//
// Note: deliberately NO jquery-globals import here -- fitb.js is jQuery-free.
import { describe, it, expect, beforeEach, vi } from "vitest";
import FITB from "../js/fitb.js";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// Feedback for one blank: first entry matches a correct answer, last entry
// always matches. See checkAnswersCore in fitb-utils.js.
function feedbackFor(answer, right = "Right", wrong = "Wrong") {
    return [
        { regex: `^${answer}$`, regexFlags: "i", feedback: right },
        { regex: ".*", regexFlags: "", feedback: wrong },
    ];
}

// The Sphinx-rendered shape: the question body is the element's innerHTML,
// with a JSON <script> holding the client-side grading data.
function makeFixture({
    id = "test_fitb_1",
    body = "<p>The capital of France is <input type='text'/>.</p>",
    feedback = [feedbackFor("paris")],
    attrs = 'data-question_label="3"',
} = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="fillintheblank" id="${id}" ${attrs}>
          ${body}
          <script type="application/json">${JSON.stringify(feedback)}<\/script>
        </div>
      </div>`;
    return document.getElementById(id);
}

async function makeFITB(fixtureOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    const fitb = new FITB({ orig: orig, useRunestoneServices: false });
    await fitb.component_ready_promise;
    await tick();
    return fitb;
}

beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("alert", vi.fn());
});

describe("accessible names for the blanks", () => {
    it("names a lone blank with the prompt, not 'input area'", async () => {
        const fitb = await makeFITB();
        const label = fitb.blankArray[0].getAttribute("aria-label");
        expect(label).toContain("The capital of France is");
        expect(label).toContain("blank 1");
        expect(label).not.toBe("input area");
    });

    it("no blank anywhere is left named 'input area'", async () => {
        const fitb = await makeFITB();
        for (const blank of fitb.blankArray) {
            expect(blank.getAttribute("aria-label")).not.toMatch(/input area/);
        }
    });

    it("numbers each blank and spells out the others in the prompt", async () => {
        const fitb = await makeFITB({
            body:
                "<p>Fill in <input type='text'/>, then <input type='text'/>," +
                " then <input type='number'/>.</p>",
            feedback: [feedbackFor("a"), feedbackFor("b"), feedbackFor("c")],
        });
        expect(fitb.blankArray).toHaveLength(3);
        const labels = fitb.blankArray.map((b) => b.getAttribute("aria-label"));
        expect(labels[0]).toMatch(/^Blank 1 of 3\./);
        expect(labels[1]).toMatch(/^Blank 2 of 3\./);
        expect(labels[2]).toMatch(/^Blank 3 of 3\./);
        // Every label carries the whole sentence, with the gaps given numbers
        // so the student can tell which one they are standing in.
        for (const label of labels) {
            expect(label).toContain(
                "Fill in blank 1, then blank 2, then blank 3.",
            );
        }
    });

    it("uses the blank's own sentence when the prompt has several", async () => {
        const fitb = await makeFITB({
            body:
                "<p>Alpha holds <input type='text'/>.</p>" +
                "<p>Beta holds <input type='text'/>.</p>",
            feedback: [feedbackFor("a"), feedbackFor("b")],
        });
        expect(fitb.blankArray[0].getAttribute("aria-label")).toContain(
            "Alpha holds",
        );
        expect(fitb.blankArray[0].getAttribute("aria-label")).not.toContain(
            "Beta",
        );
        expect(fitb.blankArray[1].getAttribute("aria-label")).toContain(
            "Beta holds",
        );
    });

    it("reads only the blank's own line inside a code listing", async () => {
        const fitb = await makeFITB({
            body:
                "<pre>def area(r):\n" +
                "    return 3.14 * r * <input type='text'/>\n" +
                "print(area(2))</pre>",
            feedback: [feedbackFor("r")],
        });
        const label = fitb.blankArray[0].getAttribute("aria-label");
        expect(label).toContain("return 3.14 * r *");
        expect(label).not.toContain("def area");
        expect(label).not.toContain("print");
    });

    it("skips content already hidden from assistive technology", async () => {
        const fitb = await makeFITB({
            body:
                "<p>Say <span aria-hidden='true'>decoration</span>" +
                " hello <input type='text'/>.</p>",
        });
        const label = fitb.blankArray[0].getAttribute("aria-label");
        expect(label).toContain("Say hello");
        expect(label).not.toContain("decoration");
    });

    it("falls back to a bare name when the prompt has no text", async () => {
        const fitb = await makeFITB({
            body: "<p><input type='text'/></p>",
        });
        // The prompt is only the blank itself, so there is nothing to read.
        expect(fitb.blankArray[0].getAttribute("aria-label")).toBe(
            "Fill in the blank. blank 1",
        );
    });

    it("names the exercise as a group", async () => {
        const fitb = await makeFITB();
        expect(fitb.containerDiv.getAttribute("role")).toBe("group");
        expect(fitb.containerDiv.getAttribute("aria-label")).toBe(
            "Fill in the blank question 3",
        );
    });

    it("relabels the blanks a dynamic problem creates", async () => {
        const fitb = await makeFITB();
        // Stand in for a re-render: replace the prompt, then re-scan.
        fitb.descriptionDiv.innerHTML =
            "<p>Two plus two is <input type='text'/>.</p>";
        fitb.setupBlanks();
        expect(fitb.blankArray[0].getAttribute("aria-label")).toContain(
            "Two plus two is",
        );
    });
});

describe("grading state on the blanks", () => {
    it("marks a wrong blank invalid and points it at its own feedback", async () => {
        const fitb = await makeFITB({
            body: "<p>Two: <input type='text'/> and three: <input type='text'/></p>",
            feedback: [
                feedbackFor("2", "Yes, 2", "No, not 2"),
                feedbackFor("3"),
            ],
        });
        fitb.blankArray[0].value = "2";
        fitb.blankArray[1].value = "9";
        fitb.checkCurrentAnswer();

        expect(fitb.blankArray[0].getAttribute("aria-invalid")).toBe("false");
        expect(fitb.blankArray[1].getAttribute("aria-invalid")).toBe("true");

        const describedBy = fitb.blankArray[1].getAttribute("aria-describedby");
        expect(describedBy).toBe("test_fitb_1_feedback_1");
        expect(document.getElementById(describedBy).textContent).toContain(
            "Wrong",
        );
    });

    it("clears the grading state when the problem is re-rendered", async () => {
        const fitb = await makeFITB();
        fitb.blankArray[0].value = "berlin";
        fitb.checkCurrentAnswer();
        expect(fitb.blankArray[0].getAttribute("aria-invalid")).toBe("true");

        fitb.clearFeedbackDiv();
        expect(fitb.blankArray[0].hasAttribute("aria-invalid")).toBe(false);
        expect(fitb.blankArray[0].hasAttribute("aria-describedby")).toBe(false);
        expect(fitb.blankArray[0].classList).not.toContain(
            "input-validation-error",
        );
        // The component's own class survives; only the alert colour is dropped.
        expect(fitb.feedBackDiv.className).toBe("fitb-feedback");
    });

    it("leaves the blanks readable after interaction is switched off", async () => {
        const fitb = await makeFITB();
        fitb.disableInteraction();
        // Disabled inputs are skipped by screen readers and by the keyboard.
        expect(fitb.blankArray[0].disabled).toBe(false);
        expect(fitb.blankArray[0].readOnly).toBe(true);
        expect(fitb.blankArray[0].getAttribute("aria-disabled")).toBe("true");
    });
});

describe("feedback announcements", () => {
    it("is a polite live region", async () => {
        const fitb = await makeFITB();
        expect(fitb.feedBackDiv.getAttribute("role")).toBe("status");
        expect(fitb.feedBackDiv.getAttribute("aria-live")).toBe("polite");
    });

    it("says correct or incorrect in words, not just a coloured mark", async () => {
        const fitb = await makeFITB();
        fitb.blankArray[0].value = "berlin";
        fitb.checkCurrentAnswer();

        const spoken = fitb.feedBackDiv.querySelector(".fitb-sr-only");
        expect(spoken.textContent.trim()).toBe("Incorrect:");
        // The check/cross glyph is decoration and must not be read as well.
        const mark = fitb.feedBackDiv.querySelector("[aria-hidden='true']");
        expect(mark.textContent).toBe("✖️");
    });

    it("does not wrap a single piece of feedback in a list", async () => {
        const fitb = await makeFITB();
        fitb.blankArray[0].value = "paris";
        fitb.checkCurrentAnswer();
        expect(fitb.feedBackDiv.querySelector("ul")).toBeNull();
        expect(fitb.feedBackDiv.textContent).toContain("Right");
    });

    it("leads a multi-blank grade with the overall verdict", async () => {
        const fitb = await makeFITB({
            body: "<p><input type='text'/> and <input type='text'/></p>",
            feedback: [feedbackFor("a"), feedbackFor("b")],
        });
        fitb.blankArray[0].value = "a";
        fitb.blankArray[1].value = "zzz";
        fitb.checkCurrentAnswer();

        expect(fitb.feedBackDiv.firstElementChild.textContent).toBe(
            "Some blanks are incorrect.",
        );
        expect(fitb.feedBackDiv.querySelectorAll("ul > li")).toHaveLength(2);
    });
});
