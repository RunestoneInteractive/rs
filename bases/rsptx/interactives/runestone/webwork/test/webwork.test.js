// Characterization tests for the WebWork component. These were first written
// against the jQuery implementation and now guard the jQuery-free version.
// Note: deliberately NO jquery-globals import here -- webwork must work
// without jQuery. The cooperation with a page that DOES provide jQuery (the
// WeBWorK server's own JS triggers events through it) is covered separately
// in webwork_jquery_interop.test.js.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "../js/webwork.js";
import RunestoneBase from "../../common/js/runestonebase.js";

function makeFixture({ id = "test_ww_1" } = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="webwork" id="${id}" class="webwork_wrapper"></div>
      </div>`;
    return document.getElementById(id);
}

// The payload WeBWorK's check-answer machinery passes along with
// runestone_ww_check (shape from a 2.17 server).
function makeWWData({ answers, ww_version = "2.17", inputs = {} } = {}) {
    return {
        ww_version,
        inputs_ref: {
            problemUUID: "test_ww_1-ww-rs",
            ...inputs,
        },
        rh_result: { answers },
    };
}

const RIGHT = {
    score: 1,
    type: "Value (Formula)",
    original_student_ans: "x+1",
    student_value: "x+1(v)",
    correct_value: "x+1",
};
const WRONG = {
    score: 0,
    type: "Value (Formula)",
    original_student_ans: "x-1",
    student_value: "x-1(v)",
    correct_value: "x+1",
};

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function makeWW(fixtureOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    return window.component_factory.webwork({
        orig,
        useRunestoneServices: false,
    });
}

beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    window.wwList = {};
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("construction", () => {
    it("registers itself in window.wwList keyed by div id", () => {
        const ww = makeWW();
        expect(window.wwList.test_ww_1).toBe(ww);
        expect(ww.containerDiv).toBe(document.getElementById("test_ww_1"));
        expect(ww.caption).toBe("WebWork");
    });
});

describe("processCurrentAnswers", () => {
    it("grades a fully correct submission", () => {
        const ww = makeWW();
        ww.processCurrentAnswers(
            makeWWData({ answers: { AnSwEr0001: RIGHT } }),
        );
        expect(ww.correct).toBe(true);
        expect(ww.percent).toBe(1);
        expect(ww.actString).toContain("actual:x+1:expected:x+1");
        expect(ww.actString).toContain("correct:1:count:1:pct:1");
        expect(ww.answerObj.answers.AnSwEr0001).toBe("x+1");
    });

    it("grades partial credit as incorrect with the right percent", () => {
        const ww = makeWW();
        ww.processCurrentAnswers(
            makeWWData({ answers: { AnSwEr0001: RIGHT, AnSwEr0002: WRONG } }),
        );
        expect(ww.correct).toBe(false);
        expect(ww.percent).toBe(0.5);
    });

    it("uses student_value for multiple-choice style answers", () => {
        const ww = makeWW();
        ww.processCurrentAnswers(
            makeWWData({
                answers: {
                    AnSwEr0001: { ...RIGHT, type: "Value (PopUp)" },
                },
            }),
        );
        expect(ww.answerObj.answers.AnSwEr0001).toBe("x+1(v)");
    });

    it("takes raw input refs on servers newer than 2.18", () => {
        const ww = makeWW();
        ww.processCurrentAnswers(
            makeWWData({
                ww_version: "2.19",
                answers: { AnSwEr0001: RIGHT },
                inputs: { AnSwEr0001: ["a", "b"] },
            }),
        );
        expect(ww.answerObj.answers.AnSwEr0001).toEqual(["a", "b"]);
    });

    it("captures MathQuill companion inputs", () => {
        const ww = makeWW();
        ww.processCurrentAnswers(
            makeWWData({
                answers: { AnSwEr0001: RIGHT },
                inputs: { MaThQuIlL_AnSwEr0001: "\\frac{1}{2}" },
            }),
        );
        expect(ww.answerObj.mqAnswers.MaThQuIlL_AnSwEr0001).toBe(
            "\\frac{1}{2}",
        );
    });

    it("saves the graded state to localStorage and decorates the question", () => {
        const ww = makeWW();
        ww.processCurrentAnswers(
            makeWWData({ answers: { AnSwEr0001: RIGHT } }),
        );
        const stored = JSON.parse(localStorage.getItem(ww.localStorageKey()));
        expect(stored.correct).toBe(true);
        expect(stored.answer.answers.AnSwEr0001).toBe("x+1");
        expect(
            document.querySelector("div.runestone").classList.contains(
                "isCorrect",
            ),
        ).toBe(true);
    });
});

describe("persistence", () => {
    it("checkLocalStorage restores answers and decorates", () => {
        const first = makeWW();
        first.processCurrentAnswers(
            makeWWData({ answers: { AnSwEr0001: WRONG } }),
        );
        const second = makeWW();
        second.checkLocalStorage();
        expect(second.correct).toBe(false);
        expect(
            document.querySelector("div.runestone").classList.contains(
                "isInCorrect",
            ),
        ).toBe(true);
    });

    it("checkLocalStorage drops malformed data", () => {
        const ww = makeWW();
        localStorage.setItem(ww.localStorageKey(), "not json{");
        ww.checkLocalStorage();
        expect(localStorage.getItem(ww.localStorageKey())).toBe(null);
    });

    it("restoreAnswers treats a null answer as empty and decorates", () => {
        const ww = makeWW();
        ww.restoreAnswers({ answer: null, correct: true, percent: 1 });
        expect(ww.answers).toBe("");
        expect(ww.correct).toBe(true);
        expect(
            document.querySelector("div.runestone").classList.contains(
                "isCorrect",
            ),
        ).toBe(true);
    });
});

describe("logCurrentAnswer", () => {
    it("logs the webwork event with the JSON answer", async () => {
        const ww = makeWW();
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        ww.processCurrentAnswers(
            makeWWData({ answers: { AnSwEr0001: RIGHT } }),
        );
        await ww.logCurrentAnswer();
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "webwork",
                div_id: "test_ww_1",
                correct: true,
                answer: JSON.stringify(ww.answerObj),
            }),
        );
    });
});

describe("page wiring", () => {
    afterEach(() => {
        eBookConfig.useRunestoneServices = false;
    });

    it("handles a natively dispatched runestone_ww_check", async () => {
        eBookConfig.useRunestoneServices = true;
        const ww = makeWW();
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        document.body.dispatchEvent(
            new CustomEvent("runestone_ww_check", {
                detail: makeWWData({ answers: { AnSwEr0001: RIGHT } }),
                bubbles: true,
            }),
        );
        await tick();
        expect(ww.correct).toBe(true);
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({ event: "webwork" }),
        );
    });

    it("logs a show event for a natively dispatched runestone_show_correct", async () => {
        eBookConfig.useRunestoneServices = true;
        makeWW();
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        document.body.dispatchEvent(
            new CustomEvent("runestone_show_correct", {
                detail: makeWWData({ answers: { AnSwEr0001: RIGHT } }),
                bubbles: true,
            }),
        );
        await tick();
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "webwork",
                div_id: "test_ww_1-ww-rs",
                act: "show",
            }),
        );
    });

    it("builds components at login-complete, skipping timed exam questions", async () => {
        document.body.innerHTML = `
          <div class="runestone">
            <div data-component="webwork" id="ww_free"></div>
          </div>
          <div data-component="timedAssessment">
            <div data-component="webwork" id="ww_timed"></div>
          </div>`;
        document.dispatchEvent(new CustomEvent("runestone:login-complete"));
        await tick();
        expect(window.wwList.ww_free).toBeDefined();
        expect(window.wwList.ww_timed).toBeUndefined();
    });
});
