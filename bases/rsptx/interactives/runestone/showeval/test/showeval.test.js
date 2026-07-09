// Characterization tests for the ShowEval component. Written first against
// the jQuery implementation (showEval.js 0.9.1); they now guard the version
// built on Al Sweigart's jQuery-free 0.10.0 core.
// Note: deliberately NO jquery-globals import here -- showeval must work
// without jQuery.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShowEval } from "../js/showEval.js";
import RunestoneBase from "../../common/js/runestonebase.js";

// The showeval directive emits the component div with its buttons and the
// step strings in window.raw_steps keyed by the div id (see README.md).
const STEPS = [
    "print({{2 + 2}}{{4}}) ## Addition happens first",
    "print({{4}}{{4}})",
];

function makeFixture({
    id = "test_se_1",
    steps = STEPS,
    tracemode = "false",
} = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="showeval" id="${id}"
             class="explainer alert alert-warning" data-tracemode="${tracemode}">
          <button class="btn btn-success" id="${id}_nextStep">Forward</button>
          <button class="btn btn-default" id="${id}_reset">Reset</button>
          <div class="evalCont"></div>
        </div>
      </div>`;
    window.raw_steps = { [id]: steps };
    return document.getElementById(id);
}

function makeShowEval(fixtureOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    return window.component_factory.showeval({
        orig,
        raw: window.raw_steps[orig.id],
        useRunestoneServices: false,
    });
}

// text of the current-step display parts
function shownParts(se) {
    const div = document.querySelector(`#${se.divid} .currentStepDiv`);
    return {
        pre: div.querySelector(".pre").innerHTML,
        eval: div.querySelector(".eval").innerHTML,
        post: div.querySelector(".post").innerHTML,
    };
}

let logSpy;
beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
    vi.restoreAllMocks();
    logSpy = vi
        .spyOn(RunestoneBase.prototype, "logBookEvent")
        .mockResolvedValue(undefined);
});

describe("construction", () => {
    it("renders the first step into pre/eval/post spans", () => {
        const se = makeShowEval();
        expect(shownParts(se)).toEqual({
            pre: "print(",
            eval: "2 + 2",
            post: ") ",
        });
    });

    it("parses ## annotations and shows them for the current step", () => {
        const se = makeShowEval();
        expect(se.steps[0][4]).toBe(" Addition happens first");
        expect(se.steps[1][4]).toBe(false);
        const anno = document.querySelector(`#${se.divid} .anno`);
        expect(anno.innerHTML).toBe(" Addition happens first");
        expect(anno.style.display).not.toBe("none");
    });

    it("strips authoring backslashes from the raw steps", () => {
        const se = makeShowEval({
            id: "test_se_esc",
            steps: ["val \\= {{1 \\+ 1}}{{2}}"],
        });
        expect(se.steps[0][0]).toBe("val = ");
        expect(se.steps[0][1]).toBe("1 + 1");
    });

    it("adds the runestone caption", () => {
        const se = makeShowEval();
        expect(
            se.containerDiv.querySelector(".runestone_caption").textContent,
        ).toBe("ShowEval");
    });
});

describe("stepping", () => {
    it("animates the evaluation and advances to the next step", async () => {
        const se = makeShowEval();
        const next = document.getElementById("test_se_1_nextStep");
        next.click();
        expect(next.disabled).toBe(true);
        await vi.waitFor(
            () => {
                expect(next.disabled).toBe(false);
            },
            { timeout: 8000, interval: 100 },
        );
        // the display has moved on to step 1
        expect(shownParts(se)).toEqual({
            pre: "print(",
            eval: "4",
            post: ")",
        });
        expect(se.currentStep).toBe(1);
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "showeval",
                act: "next",
                div_id: "test_se_1",
            }),
        );
    }, 15000);

    it("does nothing past the final step", () => {
        const se = makeShowEval();
        se.currentStep = se.steps.length;
        const next = document.getElementById("test_se_1_nextStep");
        next.click();
        expect(next.disabled).toBe(false);
        expect(se.currentStep).toBe(se.steps.length);
    });

    it("keeps a visible trace of previous steps in trace mode", () => {
        const se = makeShowEval({ id: "test_se_trace", tracemode: "true" });
        expect(se.createTrace).toBe(true);
        document.getElementById("test_se_trace_nextStep").click();
        const prev = document.querySelector("#test_se_trace .previousStep");
        expect(prev).not.toBe(null);
        expect(prev.nextElementSibling.classList.contains("currentStepDiv")).toBe(
            true,
        );
    });
});

describe("reset", () => {
    it("returns to step 0, clears the trace, and logs it", () => {
        const se = makeShowEval({ id: "test_se_r", tracemode: "true" });
        document.getElementById("test_se_r_nextStep").click();
        expect(
            document.querySelectorAll("#test_se_r .previousStep").length,
        ).toBeGreaterThan(0);
        document.getElementById("test_se_r_reset").click();
        expect(
            document.querySelectorAll("#test_se_r .previousStep").length,
        ).toBe(0);
        expect(se.currentStep).toBe(0);
        expect(shownParts(se).eval).toBe("2 + 2");
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "showeval",
                act: "reset",
                div_id: "test_se_r",
            }),
        );
    });
});

describe("page wiring", () => {
    it("builds components at login-complete, skipping timed exam questions", async () => {
        makeFixture({ id: "se_free" });
        document.body.insertAdjacentHTML(
            "beforeend",
            `<div data-component="timedAssessment">
               <div data-component="showeval" id="se_timed" data-tracemode="false"></div>
             </div>`,
        );
        window.raw_steps = { se_free: STEPS, se_timed: STEPS };
        document.dispatchEvent(new CustomEvent("runestone:login-complete"));
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(window.componentMap.se_free).toBeInstanceOf(ShowEval);
        expect(window.componentMap.se_timed).toBeUndefined();
    });
});
