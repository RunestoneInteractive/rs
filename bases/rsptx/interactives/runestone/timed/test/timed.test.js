// Characterization tests for the Timed assessment component. These were
// first written against the jQuery implementation and now guard the
// jQuery-free version.
// Note: deliberately NO jquery-globals import here -- timed must work
// without jQuery.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Timed from "../js/timed.js";
import RunestoneBase from "../../common/js/runestonebase.js";

// A timed exam wraps each question in a .runestone div. Short answer
// questions keep the fixture light (no CodeMirror/Skulpt involvement).
function makeFixture({ id = "test_timed_1", attrs = 'data-time="10"' } = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <ul data-component="timedAssessment" id="${id}" ${attrs}>
          <div class="runestone">
            <div data-component="shortanswer" id="${id}_q0">First question?</div>
          </div>
          <div class="runestone">
            <div data-component="shortanswer" id="${id}_q1">Second question?</div>
          </div>
        </ul>
      </div>`;
    return document.getElementById(id);
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const exams = [];
async function makeTimed(fixtureOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    const exam = new Timed({ orig, useRunestoneServices: false });
    exams.push(exam);
    await exam.component_ready_promise;
    await tick();
    return exam;
}

async function startExam(exam) {
    exam.startBtn.click();
    await tick();
}

const isHidden = (el) => el.classList.contains("timed-hidden");
const qnums = () => [...document.querySelectorAll("ul#pageNums > ul > li")];

let logSpy;
beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
    logSpy = vi
        .spyOn(RunestoneBase.prototype, "logBookEvent")
        .mockResolvedValue(undefined);
});

afterEach(() => {
    // stop any countdown chains so they don't outlive the test
    for (const exam of exams) {
        exam.running = 0;
        exam.done = 1;
    }
    exams.length = 0;
});

describe("construction", () => {
    it("renders timer and controls with the exam body hidden until start", async () => {
        const exam = await makeTimed();
        expect(exam.startBtn.textContent).toBe("Start");
        expect(exam.pauseBtn.disabled).toBe(true);
        expect(exam.timerContainer.innerHTML).toBe(
            "Time Remaining    10:00",
        );
        expect(isHidden(exam.timedDiv)).toBe(true);
        expect(isHidden(exam.finishButton)).toBe(true);
        expect(isHidden(exam.scoreDiv)).toBe(true);
        expect(qnums().length).toBe(2);
        expect(qnums()[0].classList.contains("active")).toBe(true);
        // Prev is disabled on the first question
        expect(exam.leftContainer.classList.contains("disabled")).toBe(true);
    });

    it("counts up when no time limit is given", async () => {
        const exam = await makeTimed({ attrs: "" });
        expect(exam.limitedTime).toBe(false);
        expect(exam.timerContainer.innerHTML).toBe("Time Taken    00:00");
    });

    it("honors the presentation data attributes", async () => {
        const exam = await makeTimed({
            attrs: 'data-time="10" data-no-timer data-no-pause data-fullwidth data-no-feedback',
        });
        expect(exam.showTimer).toBe(false);
        expect(isHidden(exam.timerContainer)).toBe(true);
        expect(exam.nopause).toBe(true);
        expect(exam.pauseBtn.parentElement).toBe(null);
        expect(exam.containerDiv.style.maxWidth).toBe("none");
        expect(exam.showFeedback).toBe(false);
    });
});

describe("starting the exam", () => {
    it("shows the first question and begins the clock", async () => {
        const exam = await makeTimed();
        await startExam(exam);
        expect(exam.running).toBe(1);
        expect(isHidden(exam.startBtn)).toBe(true);
        expect(exam.pauseBtn.disabled).toBe(false);
        expect(isHidden(exam.timedDiv)).toBe(false);
        expect(
            exam.containerDiv.querySelector(".examwarning").textContent,
        ).toContain("Warning");
        // the first question is rendered into the switch area
        expect(exam.switchDiv.classList.contains("runestone")).toBe(true);
        expect(exam.switchDiv.querySelector("textarea")).not.toBe(null);
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "timedExam",
                act: "start",
                div_id: "test_timed_1",
            }),
        );
        const seeded = JSON.parse(
            localStorage.getItem(exam.localStorageKey()),
        );
        expect(seeded.answer).toEqual([0, 0, 2, 0]);
    });
});

describe("navigation", () => {
    it("moves between questions with Next/Prev and updates the number strip", async () => {
        const exam = await makeTimed();
        await startExam(exam);
        exam.rightNavButton.click();
        await tick();
        expect(exam.currentQuestionIndex).toBe(1);
        expect(qnums()[1].classList.contains("active")).toBe(true);
        expect(qnums()[0].classList.contains("active")).toBe(false);
        // on the last question the Next side is disabled
        expect(exam.rightContainer.classList.contains("disabled")).toBe(true);
        exam.rightNavButton.click();
        await tick();
        expect(exam.currentQuestionIndex).toBe(1);
        exam.leftNavButton.click();
        await tick();
        expect(exam.currentQuestionIndex).toBe(0);
    });

    it("reveals the Finish button once every question has been visited", async () => {
        const exam = await makeTimed();
        await startExam(exam);
        expect(isHidden(exam.finishButton)).toBe(true);
        exam.rightNavButton.click();
        await tick();
        expect(isHidden(exam.finishButton)).toBe(false);
    });

    it("jumps directly via the numbered buttons", async () => {
        const exam = await makeTimed();
        await startExam(exam);
        qnums()[1].querySelector("a").click();
        await tick();
        expect(exam.currentQuestionIndex).toBe(1);
        expect(qnums()[1].classList.contains("active")).toBe(true);
    });

    it("marks a question answered (and logs it) when navigating away", async () => {
        const exam = await makeTimed();
        await startExam(exam);
        const textarea = exam.switchDiv.querySelector("textarea");
        textarea.value = "my answer";
        textarea.dispatchEvent(new Event("change"));
        exam.rightNavButton.click();
        await tick();
        expect(qnums()[0].classList.contains("answered")).toBe(true);
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "shortanswer",
                answer: "my answer",
            }),
        );
    });
});

describe("flagging", () => {
    it("toggles the flag state of the current question", async () => {
        const exam = await makeTimed();
        await startExam(exam);
        exam.flagButton.click();
        await tick();
        expect(qnums()[0].classList.contains("flagcolor")).toBe(true);
        expect(exam.flagButton.innerHTML).toBe("Unflag Question");
        exam.flagButton.click();
        await tick();
        expect(qnums()[0].classList.contains("flagcolor")).toBe(false);
        expect(exam.flagButton.innerHTML).toBe("Flag Question");
    });
});

describe("pausing", () => {
    it("hides the questions while paused and resumes cleanly", async () => {
        const exam = await makeTimed();
        await startExam(exam);
        exam.pauseBtn.click();
        expect(exam.paused).toBe(1);
        expect(exam.running).toBe(0);
        expect(isHidden(exam.timedDiv)).toBe(true);
        expect(exam.pauseBtn.innerHTML).toBe("Resume");
        exam.pauseBtn.click();
        expect(exam.running).toBe(1);
        expect(isHidden(exam.timedDiv)).toBe(false);
        expect(exam.pauseBtn.innerHTML).toBe("Pause");
    });
});

describe("finishing", () => {
    it("scores the exam, stores results, and thanks the student", async () => {
        const exam = await makeTimed();
        await startExam(exam);
        exam.rightNavButton.click();
        await tick();
        exam.finishButton.click();
        await tick(10);
        expect(exam.done).toBe(1);
        expect(exam.taken).toBe(1);
        // short answer questions grade as "I" (ignored -> skipped)
        expect(exam.skipped).toBe(2);
        expect(exam.scoreDiv.innerHTML).toContain(
            "Thank you for taking the exam",
        );
        expect(isHidden(exam.scoreDiv)).toBe(false);
        expect(exam.finishButton.disabled).toBe(true);
        expect(exam.pauseBtn.disabled).toBe(true);
        const stored = JSON.parse(
            localStorage.getItem(exam.localStorageKey()),
        );
        expect(stored.answer.length).toBe(7);
        expect(stored.answer[4]).toBe(2); // skipped count
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "timedExam",
                act: "finish",
                skipped: 2,
            }),
        );
    });

    it("submits the exam to the autograder", async () => {
        const exam = await makeTimed();
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });
        vi.stubGlobal("fetch", fetchMock);
        eBookConfig.app = "/runestone";
        await exam.submitAutograde();
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe("/runestone/assignments/student_autograde");
        expect(opts.method).toBe("POST");
        expect(String(opts.body)).toContain("assignment_id=test_timed_1");
        expect(String(opts.body)).toContain("is_timed=true");
    });
});

describe("an exam that was already taken", () => {
    it("restores the stored result and blocks a retake", async () => {
        const key = `${eBookConfig.email}:${eBookConfig.course}:test_timed_2-given`;
        localStorage.setItem(
            key,
            JSON.stringify({
                answer: [1, "1", 0, "None", 1, "2", 300],
                timestamp: new Date(),
            }),
        );
        const exam = await makeTimed({
            id: "test_timed_2",
            attrs: 'data-time="10"',
        });
        expect(exam.taken).toBeTruthy();
        expect(exam.done).toBe(1);
        expect(exam.score).toBe(1);
        expect(exam.timeTaken).toBe(300);
        expect(isHidden(exam.startBtn)).toBe(true);
        expect(exam.scoreDiv.innerHTML).toContain("Thank you for taking");
        expect(exam.timerContainer.innerHTML).toBe("Time taken: 05:00");
    });
});

describe("page wiring", () => {
    it("builds a Timed exam for each timedAssessment at login-complete", async () => {
        makeFixture({ id: "wired_timed" });
        document.dispatchEvent(new CustomEvent("runestone:login-complete"));
        await tick();
        expect(window.componentMap.wired_timed).toBeDefined();
        exams.push(window.componentMap.wired_timed);
        expect(window.componentMap.wired_timed.divid).toBe("wired_timed");
    });
});
