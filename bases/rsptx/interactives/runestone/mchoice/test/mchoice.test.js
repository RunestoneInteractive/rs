// Tests for the single-answer multiple choice component (MCMF).
//
// The regression these guard against: issue #1319. When the chosen option is
// the *first* choice in source order its answer index is 0, which is falsy in
// JavaScript. `logMCMFsubmission` used `this.givenArray[0] || ""`, so the index
// 0 was coerced to "" and the server persisted an empty answer. On reload the
// blank answer matched no option, so the question re-rendered as an unanswered
// pink ✖️ box even though the student had answered correctly. This only bit
// logged-in users, because the local-storage path stores `givenArray.join(",")`
// ("0"), while the server path went through the blanked value.
import { describe, it, expect, beforeEach, vi } from "vitest";
import MultipleChoice from "../js/mchoice.js";
import RunestoneBase from "../../common/js/runestonebase.js";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// Intermediate markup mirroring what PreTeXt emits: an .exercise-statement
// sibling plus answer/feedback <li> children. data-random is left off so the
// display order matches source order and option values are 0..n deterministically.
// The first answer is the correct one, so its source index (and input value) is 0.
function makeFixture({ id = "test_mc_1" } = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div class="exercise-statement"><p>What is 1 + 1?</p></div>
        <ul data-component="multiplechoice" id="${id}">
          <li data-component="answer" id="${id}_opt_0" data-correct="yes"><p>2</p></li>
          <li data-component="feedback"><p>Correct, 1 + 1 = 2.</p></li>
          <li data-component="answer" id="${id}_opt_1"><p>3</p></li>
          <li data-component="feedback"><p>No, that is 1 + 2.</p></li>
        </ul>
      </div>`;
    return document.getElementById(id);
}

function makeMC(fixtureOpts = {}, extraOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    return new MultipleChoice({
        orig,
        useRunestoneServices: false,
        ...extraOpts,
    });
}

// Locate the option whose input carries the given source-index value.
function optWithValue(mc, value) {
    return mc.optionArray.find((o) => o.input.value === String(value));
}

beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("construction", () => {
    it("uses source indices as option values, with the correct answer at index 0", () => {
        const mc = makeMC();
        expect(mc.correctIndexList).toEqual([0]);
        expect(mc.optionArray.map((o) => o.input.value)).toEqual(["0", "1"]);
    });
});

describe("logging a first-choice answer (issue #1319)", () => {
    it("logs the answer index 0 rather than blanking it", async () => {
        const mc = makeMC();
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        // Pick the first (correct) choice, whose source index is 0.
        optWithValue(mc, 0).input.checked = true;
        mc.submitButton.click();
        await tick();
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "mChoice",
                div_id: "test_mc_1",
                answer: "0", // not "" -- the falsy-zero bug blanked this
                correct: "T",
            }),
        );
        // The human-readable act string must carry the index too.
        expect(logSpy.mock.calls[0][0].act).toBe("answer:0:correct");
    });

    it("still logs a blank answer when nothing is selected", async () => {
        const mc = makeMC();
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        mc.submitButton.click();
        await tick();
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({ answer: "", correct: "F" }),
        );
    });
});

describe("restoring a first-choice answer", () => {
    it("re-checks index 0 and shows correct feedback via restoreAnswers", () => {
        const mc = makeMC();
        // What the server would return for a stored first-choice answer.
        mc.restoreAnswers({ answer: "0", correct: true });
        expect(optWithValue(mc, 0).input.checked).toBe(true);
        // Correct answers use the blue info alert; a blanked answer would fall
        // through to alert-danger (the pink ✖️ box from the bug report).
        expect(mc.feedBackDiv.className).toContain("alert-info");
        expect(mc.feedBackDiv.innerHTML).toContain("✔️");
    });

    it("round-trips: what gets logged for choice 0 restores correctly", async () => {
        const mc = makeMC();
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        optWithValue(mc, 0).input.checked = true;
        mc.submitButton.click();
        await tick();
        const persisted = logSpy.mock.calls[0][0];

        // Simulate a fresh page load restoring exactly what the server stored.
        localStorage.clear();
        const reloaded = makeMC({ id: "test_mc_1" });
        reloaded.restoreAnswers({
            answer: persisted.answer,
            correct: persisted.correct === "T",
        });
        expect(optWithValue(reloaded, 0).input.checked).toBe(true);
        expect(reloaded.feedBackDiv.className).toContain("alert-info");
    });
});
