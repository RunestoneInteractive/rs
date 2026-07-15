// Characterization tests for the DragNDrop component. These were first
// written against the jQuery implementation (only timeddnd.js used jQuery)
// and now guard the jQuery-free version.
// Note: deliberately NO jquery-globals import here -- dragndrop must work
// without jQuery.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import DragNDrop from "../js/dragndrop.js";
import TimedDragNDrop from "../js/timeddnd.js";
import RunestoneBase from "../../common/js/runestonebase.js";

// A question authored as a JSON <script> block (matching.js shape). p3 is a
// distractor: it appears in no correctAnswers pair.
const JSON_QUESTION = {
    statement: "Match each animal to its sound.",
    feedback: "Think about pets.",
    left: [
        { id: "p1", label: "Dog" },
        { id: "p2", label: "Cat" },
        { id: "p3", label: "Rock" },
    ],
    right: [
        { id: "r1", label: "Barks" },
        { id: "r2", label: "Meows" },
    ],
    correctAnswers: [
        ["p1", "r1"],
        ["p2", "r2"],
    ],
};

// data-random="no" keeps premise order deterministic.
function makeJsonFixture({ id = "test_dnd_1", question = JSON_QUESTION } = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <ul data-component="dragndrop" id="${id}" data-random="no">
          <script type="application/json">${JSON.stringify(question)}</script>
        </ul>
      </div>`;
    return document.getElementById(id);
}

// The legacy markup: draggable/dropzone pairs linked by data-category.
function makeLegacyFixture({ id = "test_dnd_legacy" } = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <ul data-component="dragndrop" id="${id}" data-random="no">
          <span data-subcomponent="question">Match the terms.</span>
          <span id="drag_a" data-subcomponent="draggable" data-category="cat_a">Alpha</span>
          <span for="drag_a" data-subcomponent="dropzone" data-category="cat_a">First letter</span>
          <span id="drag_b" data-subcomponent="draggable" data-category="cat_b">Beta</span>
          <span for="drag_b" data-subcomponent="dropzone" data-category="cat_b">Second letter</span>
          <span data-subcomponent="feedback">A hint.</span>
        </ul>
      </div>`;
    return document.getElementById(id);
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function makeDnd(fixtureOpts = {}, extraOpts = {}, Cls = DragNDrop) {
    const orig = makeJsonFixture(fixtureOpts);
    const dnd = new Cls({
        orig: orig,
        useRunestoneServices: false,
        ...extraOpts,
    });
    await dnd.component_ready_promise;
    await tick();
    return dnd;
}

// Simulate dropping a premise into a response zone the way the drop handler
// would: the grading code only reads the DOM.
function place(dnd, premiseId, responseId) {
    const premise = dnd.premiseArray.find((p) => p.id === premiseId);
    const response = dnd.responseArray.find((r) => r.id === responseId);
    response.appendChild(premise);
}

// Feedback text is written inside a setTimeout(…, 10).
const feedbackSettles = () => tick(20);

beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("alert", vi.fn());
});

describe("construction from a JSON script block", () => {
    it("replaces the original element with statement, dragzone and dropzone", async () => {
        const dnd = await makeDnd();
        const container = document.getElementById("test_dnd_1");
        expect(container).toBe(dnd.containerDiv);
        expect(container.querySelector(".cardsort-statement").textContent).toBe(
            "Match each animal to its sound.",
        );
        const dragIds = [...dnd.draggableDiv.querySelectorAll(".premise")].map(
            (el) => el.id,
        );
        expect(dragIds).toEqual(["p1", "p2", "p3"]);
        const dropIds = [...dnd.dropZoneDiv.querySelectorAll(".response")].map(
            (el) => el.id,
        );
        expect(dropIds).toEqual(["r1", "r2"]);
    });

    it("gives paired premises the response id as category and distractors their own", async () => {
        const dnd = await makeDnd();
        const byId = Object.fromEntries(
            dnd.premiseArray.map((p) => [p.id, p.dataset.category]),
        );
        expect(byId.p1).toBe("r1");
        expect(byId.p2).toBe("r2");
        expect(byId.p3).toBe("distractor-p3");
    });

    it("creates Check me and Reset buttons", async () => {
        const dnd = await makeDnd();
        expect(dnd.submitButton.textContent).toBe("Check me");
        expect(dnd.resetButton.textContent).toBe("Reset");
    });

    it("makes premises draggable and keyboard-operable", async () => {
        const dnd = await makeDnd();
        for (const premise of dnd.premiseArray) {
            expect(premise.getAttribute("draggable")).toBe("true");
            expect(premise.getAttribute("role")).toBe("button");
            expect(premise.tabIndex).toBe(0);
        }
    });

    it("stores the author feedback for use in incorrect messages", async () => {
        const dnd = await makeDnd();
        expect(dnd.feedback).toBe("Think about pets.");
    });
});

describe("construction from legacy data-subcomponent markup", () => {
    it("builds premises and responses from draggable/dropzone pairs", async () => {
        const orig = makeLegacyFixture();
        const dnd = new DragNDrop({ orig, useRunestoneServices: false });
        await dnd.component_ready_promise;
        await tick();
        expect(dnd.question).toBe("Match the terms.");
        expect(dnd.feedback).toBe("A hint.");
        expect(dnd.premiseArray.map((p) => p.id)).toEqual(["drag_a", "drag_b"]);
        // dropzone ids are derived from the for attribute
        expect(dnd.responseArray.map((r) => r.id)).toEqual([
            "drop_a",
            "drop_b",
        ]);
        expect(dnd.premiseArray[0].dataset.category).toBe("cat_a");
        expect(dnd.responseArray[0].dataset.category).toBe("cat_a");
    });
});

describe("grading", () => {
    it("is correct when all pairs are placed right and distractors stay", async () => {
        const dnd = await makeDnd();
        place(dnd, "p1", "r1");
        place(dnd, "p2", "r2");
        dnd.checkCurrentAnswer();
        expect(dnd.correct).toBe(true);
        expect(dnd.correctNum).toBe(3); // p1, p2 placed + p3 left alone
        expect(dnd.incorrectNum).toBe(0);
        expect(dnd.enoughPlaced).toBe(true);
    });

    it("is incorrect when a premise is in the wrong zone", async () => {
        const dnd = await makeDnd();
        place(dnd, "p1", "r2");
        place(dnd, "p2", "r1");
        dnd.checkCurrentAnswer();
        expect(dnd.correct).toBe(false);
        expect(dnd.incorrectNum).toBe(2);
    });

    it("is incorrect when a distractor is placed in a zone", async () => {
        const dnd = await makeDnd();
        place(dnd, "p1", "r1");
        place(dnd, "p2", "r2");
        place(dnd, "p3", "r1");
        dnd.checkCurrentAnswer();
        expect(dnd.correct).toBe(false);
        expect(dnd.incorrectNum).toBe(1);
    });

    it("requires all non-distractor premises to be placed before grading", async () => {
        const dnd = await makeDnd();
        place(dnd, "p1", "r1");
        dnd.checkCurrentAnswer();
        expect(dnd.enoughPlaced).toBe(false);
        expect(dnd.requiredPlacements).toBe(2);
        expect(dnd.placedNum).toBe(1);
    });

    it("saves correctness into localStorage on check", async () => {
        const dnd = await makeDnd();
        place(dnd, "p1", "r1");
        place(dnd, "p2", "r2");
        dnd.checkCurrentAnswer();
        const stored = JSON.parse(localStorage.getItem(dnd.localStorageKey()));
        expect(stored.correct).toBe("T");
        expect(stored.answer).toEqual({ r1: ["p1"], r2: ["p2"] });
    });
});

describe("feedback rendering", () => {
    it("asks for more placements before grading", async () => {
        const dnd = await makeDnd();
        place(dnd, "p1", "r1");
        dnd.checkCurrentAnswer();
        dnd.renderFeedback();
        await feedbackSettles();
        expect(dnd.feedBackDiv.textContent).toContain(
            "Please place all of the cards",
        );
        expect(dnd.feedBackDiv.textContent).toContain("You have 1 left");
        expect(dnd.feedBackDiv.className).toContain("alert-warning");
    });

    it("celebrates a correct answer", async () => {
        const dnd = await makeDnd();
        place(dnd, "p1", "r1");
        place(dnd, "p2", "r2");
        dnd.submitButton.click();
        await feedbackSettles();
        expect(dnd.feedBackDiv.innerHTML).toBe("You are correct!");
        expect(dnd.feedBackDiv.className).toContain("alert-info");
    });

    it("reports counts and author feedback when incorrect", async () => {
        const dnd = await makeDnd();
        place(dnd, "p1", "r2");
        place(dnd, "p2", "r1");
        dnd.submitButton.click();
        await feedbackSettles();
        expect(dnd.feedBackDiv.textContent).toContain(
            "you placed 1 correctly and 2 incorrectly",
        );
        expect(dnd.feedBackDiv.textContent).toContain("Think about pets.");
        expect(dnd.feedBackDiv.className).toContain("alert-danger");
    });

    it("only colors misplaced blocks red after three gradeable tries", async () => {
        const dnd = await makeDnd();
        place(dnd, "p1", "r2");
        place(dnd, "p2", "r1");
        const p1 = dnd.premiseArray.find((p) => p.id === "p1");
        dnd.submitButton.click();
        await feedbackSettles();
        expect(p1.classList.contains("drop-incorrect")).toBe(false);
        dnd.submitButton.click();
        await feedbackSettles();
        expect(p1.classList.contains("drop-incorrect")).toBe(false);
        dnd.submitButton.click();
        await feedbackSettles();
        expect(p1.classList.contains("drop-incorrect")).toBe(true);
        expect(p1.getAttribute("aria-invalid")).toBe("true");
        expect(p1.getAttribute("aria-errormessage")).toBe("p1_error");
    });
});

describe("reset", () => {
    it("returns premises to the dragzone and starts the try count over", async () => {
        const dnd = await makeDnd();
        place(dnd, "p1", "r2");
        dnd.submitButton.click();
        await feedbackSettles();
        dnd.resetButton.click();
        expect(dnd.draggableDiv.querySelectorAll(".premise").length).toBe(3);
        expect(dnd.dropZoneDiv.querySelectorAll(".premise").length).toBe(0);
        // reset clears the state, then saving regenerates it (empty) from the DOM
        expect(dnd.answerState).toEqual({ r1: [], r2: [] });
        expect(dnd.tries).toBe(0);
        expect(dnd.feedBackDiv.style.display).toBe("none");
    });
});

describe("keyboard controls", () => {
    it("starts with only premises in the tab order", async () => {
        const dnd = await makeDnd();
        expect(
            dnd.premiseArray.every((premise) => premise.tabIndex === 0),
        ).toBe(true);
        expect(
            dnd.responseArray.every((response) => response.tabIndex === -1),
        ).toBe(true);
    });

    it("moves focus between unselected premises with ArrowUp and ArrowDown", async () => {
        const dnd = await makeDnd();
        const [firstPremise, secondPremise] = dnd.premiseArray;
        firstPremise.focus();

        firstPremise.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowDown",
                bubbles: true,
            }),
        );
        expect(document.activeElement).toBe(secondPremise);
        expect(dnd.selectedPremise).toBe(null);

        secondPremise.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowUp",
                bubbles: true,
            }),
        );
        expect(document.activeElement).toBe(firstPremise);
    });

    it.each(["Enter", " "])(
        "places the selected premise in a response with %j",
        async (key) => {
            const dnd = await makeDnd();
            const premise = dnd.premiseArray.find((p) => p.id === "p1");
            const response = dnd.responseArray.find((r) => r.id === "r1");

            premise.dispatchEvent(
                new KeyboardEvent("keydown", { key, bubbles: true }),
            );
            expect(dnd.selectedPremise).toBe(premise);
            expect(premise.classList.contains("selected")).toBe(true);
            expect(premise.getAttribute("aria-pressed")).toBe("true");
            expect(document.activeElement).toBe(dnd.responseArray[0]);
            expect(dnd.responseArray[0].contains(premise)).toBe(true);
            expect(dnd.premiseArray.every((item) => item.tabIndex === -1)).toBe(
                true,
            );
            expect(dnd.responseArray.every((item) => item.tabIndex === 0)).toBe(
                true,
            );

            response.dispatchEvent(
                new KeyboardEvent("keydown", { key, bubbles: true }),
            );
            expect(response.contains(premise)).toBe(true);
            expect(dnd.selectedPremise).toBe(null);
            expect(premise.classList.contains("selected")).toBe(false);
            expect(premise.getAttribute("aria-pressed")).toBe("false");
            expect(dnd.isAnswered).toBe(true);
            expect(document.activeElement).toBe(premise);
            expect(dnd.premiseArray.every((item) => item.tabIndex === 0)).toBe(
                true,
            );
            expect(
                dnd.responseArray.every((item) => item.tabIndex === -1),
            ).toBe(true);
        },
    );

    it("Escape restores premise navigation and focus", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray.find((p) => p.id === "p2");

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        dnd.responseArray[0].dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );

        expect(dnd.selectedPremise).toBe(null);
        expect(document.activeElement).toBe(premise);
        expect(dnd.premiseArray.every((item) => item.tabIndex === 0)).toBe(
            true,
        );
        expect(dnd.responseArray.every((item) => item.tabIndex === -1)).toBe(
            true,
        );
    });

    it("does not treat a key event from a nested premise as response activation", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray.find((p) => p.id === "p1");
        const response = dnd.responseArray.find((r) => r.id === "r1");
        response.appendChild(premise);

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(dnd.selectedPremise).toBe(premise);
        expect(premise.classList.contains("selected")).toBe(true);
    });

    it("keeps an already placed premise in its response when selected", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const [, secondResponse] = dnd.responseArray;
        secondResponse.appendChild(premise);

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );

        expect(secondResponse.contains(premise)).toBe(true);
        expect(document.activeElement).toBe(secondResponse);
        expect(dnd.selectedPremise).toBe(premise);
    });

    it("moves the selected premise through responses with the arrow keys", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray.find((p) => p.id === "p1");
        const [firstResponse, secondResponse] = dnd.responseArray;

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(firstResponse.contains(premise)).toBe(true);
        expect(dnd.selectedPremise).toBe(premise);

        firstResponse.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowDown",
                bubbles: true,
            }),
        );
        expect(secondResponse.contains(premise)).toBe(true);
        expect(document.activeElement).toBe(secondResponse);

        secondResponse.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowUp",
                bubbles: true,
            }),
        );
        expect(firstResponse.contains(premise)).toBe(true);
        expect(document.activeElement).toBe(firstResponse);
        expect(premise.classList.contains("selected")).toBe(true);
    });

    it("previews the selected premise in each response focused with Tab", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const [firstResponse, secondResponse] = dnd.responseArray;

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(firstResponse.contains(premise)).toBe(true);

        // Calling focus mirrors the focus change produced by Tab in the
        // browser without relying on jsdom to implement Tab navigation.
        secondResponse.focus();
        expect(secondResponse.contains(premise)).toBe(true);
        expect(dnd.selectedPremise).toBe(premise);

        firstResponse.focus();
        expect(firstResponse.contains(premise)).toBe(true);
        expect(dnd.selectedPremise).toBe(premise);
    });

    it("traps Tab and Shift+Tab within responses while a premise is selected", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const [firstResponse, secondResponse] = dnd.responseArray;

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(document.activeElement).toBe(firstResponse);

        firstResponse.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
        );
        expect(document.activeElement).toBe(secondResponse);
        expect(secondResponse.contains(premise)).toBe(true);

        secondResponse.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
        );
        expect(document.activeElement).toBe(firstResponse);
        expect(firstResponse.contains(premise)).toBe(true);

        firstResponse.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Tab",
                shiftKey: true,
                bubbles: true,
            }),
        );
        expect(document.activeElement).toBe(secondResponse);
        expect(secondResponse.contains(premise)).toBe(true);
    });

    it("returns a placed selected premise to the dragzone with ArrowLeft", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray.find((p) => p.id === "p1");
        const response = dnd.responseArray[0];
        response.appendChild(premise);

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        response.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowLeft",
                bubbles: true,
            }),
        );

        expect(premise.parentElement).toBe(dnd.draggableDiv);
        expect(dnd.selectedPremise).toBe(premise);
        expect(premise.classList.contains("selected")).toBe(true);
        expect(dnd.responseArray.every((item) => item.tabIndex === 0)).toBe(
            true,
        );
    });

    it("moves a selected premise right into the focused response", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const firstResponse = dnd.responseArray[0];

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        firstResponse.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowLeft",
                bubbles: true,
            }),
        );
        expect(premise.parentElement).toBe(dnd.draggableDiv);
        expect(document.activeElement).toBe(firstResponse);

        firstResponse.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowRight",
                bubbles: true,
            }),
        );
        expect(firstResponse.contains(premise)).toBe(true);
        expect(dnd.selectedPremise).toBe(premise);
    });
});

describe("pointer controls", () => {
    it("highlights responses only while a premise is being dragged", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const dragStart = new Event("dragstart", { bubbles: true });
        Object.defineProperty(dragStart, "dataTransfer", {
            value: { setData: vi.fn() },
        });

        premise.dispatchEvent(dragStart);
        expect(dnd.containerDiv.classList.contains("pointer-drag-active")).toBe(
            true,
        );

        premise.dispatchEvent(new Event("dragend", { bubbles: true }));
        expect(dnd.containerDiv.classList.contains("pointer-drag-active")).toBe(
            false,
        );
    });
});

describe("persistence", () => {
    it("restores placements from localStorage on a fresh render", async () => {
        const first = await makeDnd();
        place(first, "p1", "r1");
        first.checkCurrentAnswer();
        const second = await makeDnd();
        const r1 = second.responseArray.find((r) => r.id === "r1");
        expect([...r1.querySelectorAll(".premise")].map((p) => p.id)).toEqual([
            "p1",
        ]);
        expect(
            [...second.draggableDiv.querySelectorAll(".premise")].map(
                (p) => p.id,
            ),
        ).toEqual(["p2", "p3"]);
    });

    it("restores placements from server data via restoreAnswers", async () => {
        // restoreAnswers is only reached on the logged-in server path, where
        // the original element has not yet been replaced.
        eBookConfig.isLoggedIn = true;
        const orig = makeJsonFixture();
        const dnd = new DragNDrop({
            orig,
            useRunestoneServices: true,
            assessmentTaken: false,
        });
        dnd.restoreAnswers({
            answer: JSON.stringify({ r1: ["p1"], r2: ["p2"] }),
            min_height: 100,
            drag_width: 40,
            drop_width: 56,
            correct: true,
        });
        const r2 = dnd.responseArray.find((r) => r.id === "r2");
        expect([...r2.querySelectorAll(".premise")].map((p) => p.id)).toEqual([
            "p2",
        ]);
        expect(dnd.correct).toBe(true);
    });

    it("drops malformed stored data", async () => {
        const key = `${eBookConfig.email}:${eBookConfig.course}:test_dnd_1-given`;
        localStorage.setItem(key, "not json{");
        const dnd = await makeDnd();
        expect(dnd.localStorageKey()).toBe(key);
        expect(localStorage.getItem(key)).toBe(null);
    });
});

describe("logging", () => {
    it("logs the answer state on submit", async () => {
        const dnd = await makeDnd();
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        place(dnd, "p1", "r1");
        place(dnd, "p2", "r2");
        dnd.submitButton.click();
        await tick();
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "dragNdrop",
                div_id: "test_dnd_1",
                correct: true,
                answer: JSON.stringify({ r1: ["p1"], r2: ["p2"] }),
            }),
        );
    });
});

describe("guards", () => {
    it("rejects premises belonging to a different dragndrop instance", async () => {
        const dnd = await makeDnd();
        const stranger = document.createElement("span");
        stranger.dataset.parent_id = "some_other_dnd";
        expect(dnd.strangerDanger(stranger)).toBe(true);
        expect(dnd.strangerDanger(dnd.premiseArray[0])).toBe(false);
    });

    it("disableInteraction hides reset and stops dragging", async () => {
        const dnd = await makeDnd();
        dnd.disableInteraction();
        expect(dnd.resetButton.style.display).toBe("none");
        for (const premise of dnd.premiseArray) {
            expect(premise.draggable).toBe(false);
        }
    });
});

describe("TimedDragNDrop", () => {
    // Timed exams require login; the logged-out path would replace the
    // original element inside the constructor and then the timed
    // constructor's own finishSettingUp would find it already gone.
    async function makeTimedDnd(fixtureOpts = {}) {
        eBookConfig.isLoggedIn = true;
        return makeDnd(
            fixtureOpts,
            { timed: true, useRunestoneServices: true, assessmentTaken: false },
            TimedDragNDrop,
        );
    }

    beforeEach(() => {
        vi.spyOn(RunestoneBase.prototype, "logBookEvent").mockResolvedValue(
            undefined,
        );
    });

    afterEach(() => {
        eBookConfig.isLoggedIn = false;
    });

    it("hides the submit button and shows the clock icon", async () => {
        const dnd = await makeTimedDnd();
        expect(dnd.submitButton.style.display).toBe("none");
        const icon = dnd.containerDiv.querySelector(".timeTip img");
        expect(icon.getAttribute("src")).toContain("clock.png");
        expect(dnd.containerDiv.firstChild.className).toBe("timeTip");
    });

    it("grades T/F for timed assessments", async () => {
        const dnd = await makeTimedDnd();
        place(dnd, "p1", "r1");
        place(dnd, "p2", "r2");
        dnd.checkCurrentAnswer();
        expect(dnd.checkCorrectTimed()).toBe("T");
        dnd.resetButton.click();
        place(dnd, "p1", "r2");
        place(dnd, "p2", "r1");
        dnd.checkCurrentAnswer();
        expect(dnd.checkCorrectTimed()).toBe("F");
    });

    it("grades an untouched distractor-free question as unanswered", async () => {
        // The unanswered check compares against every premise, so it can only
        // trigger when the question has no distractors.
        const dnd = await makeTimedDnd({
            id: "test_dnd_nodistractor",
            question: {
                statement: "Match.",
                left: [
                    { id: "q1", label: "One" },
                    { id: "q2", label: "Two" },
                ],
                right: [
                    { id: "z1", label: "1" },
                    { id: "z2", label: "2" },
                ],
                correctAnswers: [
                    ["q1", "z1"],
                    ["q2", "z2"],
                ],
            },
        });
        dnd.checkCurrentAnswer();
        expect(dnd.checkCorrectTimed()).toBe(null);
    });

    it("can hide its feedback between questions", async () => {
        const dnd = await makeTimedDnd();
        dnd.feedBackDiv.style.display = "block";
        dnd.hideFeedback();
        expect(dnd.feedBackDiv.style.display).toBe("none");
    });

    it("the factory picks the timed variant from opts.timed", async () => {
        eBookConfig.isLoggedIn = false;
        const plain = window.component_factory.dragndrop({
            orig: makeJsonFixture({ id: "dnd_plain" }),
            useRunestoneServices: false,
        });
        expect(plain).toBeInstanceOf(DragNDrop);
        expect(plain).not.toBeInstanceOf(TimedDragNDrop);
        eBookConfig.isLoggedIn = true;
        const timed = window.component_factory.dragndrop({
            orig: makeJsonFixture({ id: "dnd_timed" }),
            useRunestoneServices: true,
            assessmentTaken: false,
            timed: true,
        });
        expect(timed).toBeInstanceOf(TimedDragNDrop);
    });
});
