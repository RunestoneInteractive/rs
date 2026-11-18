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

// Two premises that belong in the same dropzone, in the markup the assignment
// builder generates for a many-to-one question.
function makeManyToOneFixture({ id = "test_dnd_many" } = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <ul data-component="dragndrop" id="${id}" data-random="no">
          <span data-subcomponent="question">Sort the food.</span>
          <li data-subcomponent="draggable" id="${id}_drag_l1" data-category="${id}_cat_r1">Corn</li>
          <li data-subcomponent="dropzone" for="${id}_drag_l1" data-category="${id}_cat_r1">Vegetable</li>
          <li data-subcomponent="draggable" id="${id}_drag_l2" data-category="${id}_cat_r1">Peas</li>
          <li data-subcomponent="draggable" id="${id}_drag_l3" data-category="${id}_cat_r2">Pear</li>
          <li data-subcomponent="dropzone" for="${id}_drag_l3" data-category="${id}_cat_r2">Fruit</li>
          <span data-subcomponent="feedback">Not quite.</span>
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

function renderMathSpeech(element, speech) {
    const math = element.querySelector(".process-math") || element;
    math.innerHTML =
        '<mjx-container data-semantic-speech-none="' +
        speech +
        '"><mjx-math aria-hidden="true">ignored</mjx-math></mjx-container>';
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

    it("grades every premise that shares a dropzone as correct", async () => {
        const id = "test_dnd_many";
        const orig = makeManyToOneFixture({ id });
        const dnd = new DragNDrop({ orig, useRunestoneServices: false });
        await dnd.component_ready_promise;
        await tick();
        // Both Corn and Peas belong in the Vegetable zone.
        place(dnd, `${id}_drag_l1`, `${id}_drop_l1`);
        place(dnd, `${id}_drag_l2`, `${id}_drop_l1`);
        place(dnd, `${id}_drag_l3`, `${id}_drop_l3`);
        dnd.checkCurrentAnswer();
        expect(dnd.incorrectNum).toBe(0);
        expect(dnd.correctNum).toBe(3);
        expect(dnd.correct).toBe(true);
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
        const p1Error = document.getElementById("p1_error");
        expect(p1Error.classList.contains("visuallyhidden")).toBe(true);
        dnd.submitButton.click();
        await feedbackSettles();
        expect(p1.classList.contains("drop-incorrect")).toBe(false);
        dnd.submitButton.click();
        await feedbackSettles();
        expect(p1.classList.contains("drop-incorrect")).toBe(false);
        dnd.submitButton.click();
        await feedbackSettles();
        expect(p1.classList.contains("drop-incorrect")).toBe(true);
        expect(p1Error.classList.contains("visuallyhidden")).toBe(false);
        expect(p1.getAttribute("aria-invalid")).toBe("true");
        expect(p1.getAttribute("aria-errormessage")).toBe("p1_error");
    });
});

describe("returning a misplaced premise", () => {
    async function dndWithRedPremise() {
        const dnd = await makeDnd();
        place(dnd, "p1", "r2");
        place(dnd, "p2", "r1");
        for (let i = 0; i < 3; i++) {
            dnd.submitButton.click();
            await feedbackSettles();
        }
        const p1 = dnd.premiseArray.find((p) => p.id === "p1");
        expect(p1.classList.contains("drop-incorrect")).toBe(true);
        return { dnd, p1 };
    }

    function expectNotMarkedIncorrect(premise) {
        expect(premise.classList.contains("drop-incorrect")).toBe(false);
        expect(premise.getAttribute("aria-invalid")).toBe("false");
        expect(premise.hasAttribute("aria-errormessage")).toBe(false);
        expect(
            document
                .getElementById(premise.id + "_error")
                .classList.contains("visuallyhidden"),
        ).toBe(true);
    }

    it("clears its red styling when dropped back in the dragzone", async () => {
        const { dnd, p1 } = await dndWithRedPremise();
        const drop = new Event("drop", { bubbles: true, cancelable: true });
        Object.defineProperty(drop, "dataTransfer", {
            value: { getData: () => p1.id },
        });

        dnd.draggableDiv.dispatchEvent(drop);

        expect(p1.parentElement).toBe(dnd.draggableDiv);
        expectNotMarkedIncorrect(p1);
    });

    it("clears its red styling when returned with the keyboard", async () => {
        const { dnd, p1 } = await dndWithRedPremise();

        p1.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        p1.parentElement.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
        );

        expect(p1.parentElement).toBe(dnd.draggableDiv);
        expectNotMarkedIncorrect(p1);
    });

    it("keeps a premise red while it stays in a response", async () => {
        const { dnd } = await dndWithRedPremise();
        const p2 = dnd.premiseArray.find((p) => p.id === "p2");

        dnd.responseArray.find((r) => r.id === "r2").appendChild(p2);
        dnd.updatePremiseAriaLabel(p2);

        expect(p2.classList.contains("drop-incorrect")).toBe(true);
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

    it("moves focus between unselected premises in tab order", async () => {
        const dnd = await makeDnd();
        const p1 = dnd.premiseArray.find((p) => p.id === "p1");
        const p2 = dnd.premiseArray.find((p) => p.id === "p2");
        const p3 = dnd.premiseArray.find((p) => p.id === "p3");
        place(dnd, "p2", "r1");
        place(dnd, "p1", "r2");

        p3.focus();
        p3.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowDown",
                bubbles: true,
            }),
        );
        expect(document.activeElement).toBe(p2);

        p2.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowDown",
                bubbles: true,
            }),
        );
        expect(document.activeElement).toBe(p1);

        p1.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowUp",
                bubbles: true,
            }),
        );
        expect(document.activeElement).toBe(p2);
        expect(dnd.selectedPremise).toBe(null);
    });

    it("moves focus to the first premise in the left or right column", async () => {
        const dnd = await makeDnd();
        const p1 = dnd.premiseArray.find((p) => p.id === "p1");
        const p2 = dnd.premiseArray.find((p) => p.id === "p2");
        const p3 = dnd.premiseArray.find((p) => p.id === "p3");
        place(dnd, "p2", "r1");
        place(dnd, "p1", "r2");

        p3.focus();
        p3.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowRight",
                bubbles: true,
            }),
        );
        expect(document.activeElement).toBe(p2);

        p1.focus();
        p1.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowLeft",
                bubbles: true,
            }),
        );
        expect(document.activeElement).toBe(p3);
        expect(dnd.selectedPremise).toBe(null);
    });

    it("selects and places a premise with click events", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray.find((p) => p.id === "p1");
        const response = dnd.responseArray.find((r) => r.id === "r2");

        premise.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        expect(dnd.selectedPremise).toBe(premise);
        expect(premise.classList.contains("selected")).toBe(true);
        expect(premise.getAttribute("aria-pressed")).toBe("true");

        response.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        expect(response.contains(premise)).toBe(true);
        expect(dnd.selectedPremise).toBe(null);
        expect(premise.classList.contains("selected")).toBe(false);
        expect(premise.getAttribute("aria-pressed")).toBe("false");
        expect(dnd.isAnswered).toBe(true);
    });

    it("selects a premise from a nested click", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const nested = document.createElement("span");
        premise.appendChild(nested);

        nested.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
        );

        expect(dnd.selectedPremise).toBe(premise);
        expect(premise.classList.contains("selected")).toBe(true);
    });

    it("places a selected premise from a nested response click", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const response = dnd.responseArray[1];
        const nested = document.createElement("span");
        response.appendChild(nested);

        premise.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        nested.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
        );

        expect(response.contains(premise)).toBe(true);
        expect(dnd.selectedPremise).toBe(null);
        expect(premise.classList.contains("selected")).toBe(false);
    });

    it("updates premise aria labels as premises are placed and returned", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray.find((p) => p.id === "p1");
        const response = dnd.responseArray.find((r) => r.id === "r1");

        expect(premise.getAttribute("aria-label")).toBe(
            "Dog matching premise, unplaced",
        );

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(response.contains(premise)).toBe(true);
        expect(premise.getAttribute("aria-label")).toBe(
            "Dog matching premise, placed in Barks",
        );

        dnd.dragDropWrapDiv.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
        );
        expect(premise.parentElement).toBe(dnd.draggableDiv);
        expect(premise.getAttribute("aria-label")).toBe(
            "Dog matching premise, unplaced",
        );
    });

    it("uses MathJax speech for premise aria labels", async () => {
        const dnd = await makeDnd({
            question: {
                statement: "Match each function to its derivative.",
                left: [
                    {
                        id: "p1",
                        label: '<span class="process-math">\(x^2\)</span>',
                    },
                ],
                right: [
                    {
                        id: "r1",
                        label: '<span class="process-math">\(2x\)</span>',
                    },
                ],
                correctAnswers: [["p1", "r1"]],
            },
        });
        const premise = dnd.premiseArray[0];
        const response = dnd.responseArray[0];

        renderMathSpeech(premise, "x squared");
        renderMathSpeech(response, "two x");
        dnd.updatePremiseAriaLabels();

        expect(premise.getAttribute("aria-label")).toBe(
            "x squared matching premise, unplaced",
        );

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );

        expect(premise.getAttribute("aria-label")).toBe(
            "x squared matching premise, placed in two x",
        );
        expect(dnd.keyboardInstructionDiv.textContent).toBe(
            "Moving x squared. Use arrow keys to choose a target, Enter to place, or Escape to cancel.",
        );
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
            expect(document.activeElement).toBe(dnd.dragDropWrapDiv);
            expect(dnd.dragDropWrapDiv.getAttribute("role")).toBe(
                "application",
            );
            expect(
                dnd.dragDropWrapDiv.getAttribute("aria-activedescendant"),
            ).toBe(response.id);
            expect(dnd.keyboardInstructionDiv.textContent).toBe(
                "Moving Dog. Use arrow keys to choose a target, Enter to place, or Escape to cancel.",
            );
            expect(dnd.responseArray[0].contains(premise)).toBe(true);
            expect(dnd.premiseArray.every((item) => item.tabIndex === -1)).toBe(
                true,
            );
            expect(dnd.responseArray.every((item) => item.tabIndex === 0)).toBe(
                true,
            );

            dnd.dragDropWrapDiv.dispatchEvent(
                new KeyboardEvent("keydown", { key, bubbles: true }),
            );
            expect(response.contains(premise)).toBe(true);
            expect(dnd.selectedPremise).toBe(null);
            expect(premise.classList.contains("selected")).toBe(false);
            expect(premise.getAttribute("aria-pressed")).toBe("false");
            expect(dnd.isAnswered).toBe(true);
            expect(document.activeElement).toBe(premise);
            expect(dnd.dragDropWrapDiv.getAttribute("role")).toBe(null);
            expect(dnd.dragDropWrapDiv.tabIndex).toBe(-1);
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
        dnd.dragDropWrapDiv.dispatchEvent(
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

    it("removes premise math content from the tab order", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const nestedMath = document.createElement("span");
        const nestedMathChild = document.createElement("span");
        nestedMath.className = "MathJax";
        nestedMath.tabIndex = 0;
        nestedMathChild.tabIndex = 0;
        nestedMath.appendChild(nestedMathChild);
        premise.appendChild(nestedMath);

        dnd.disablePremiseMathTabStops();

        expect(nestedMath.tabIndex).toBe(-1);
        expect(nestedMathChild.tabIndex).toBe(-1);
    });

    it("captures Space on the premise when it contains math content", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const nestedMath = document.createElement("span");
        nestedMath.className = "MathJax";
        premise.appendChild(nestedMath);

        const event = new KeyboardEvent("keydown", {
            key: " ",
            bubbles: true,
            cancelable: true,
        });
        premise.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(dnd.selectedPremise).toBe(premise);
        expect(premise.classList.contains("selected")).toBe(true);
    });
    it("does not capture Space from nested premise content", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const nestedMath = document.createElement("span");
        nestedMath.className = "MathJax";
        premise.appendChild(nestedMath);

        const event = new KeyboardEvent("keydown", {
            key: " ",
            bubbles: true,
            cancelable: true,
        });
        nestedMath.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(dnd.selectedPremise).toBe(null);
        expect(premise.classList.contains("selected")).toBe(false);
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
        expect(document.activeElement).toBe(dnd.dragDropWrapDiv);
        expect(dnd.activeResponse).toBe(secondResponse);
        expect(dnd.dragDropWrapDiv.getAttribute("aria-activedescendant")).toBe(
            secondResponse.id,
        );
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

    it("traps Tab and Shift+Tab within the application surface while a premise is selected", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const [firstResponse, secondResponse] = dnd.responseArray;

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(document.activeElement).toBe(dnd.dragDropWrapDiv);
        expect(firstResponse.contains(premise)).toBe(true);

        dnd.dragDropWrapDiv.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
        );
        expect(document.activeElement).toBe(dnd.dragDropWrapDiv);
        expect(dnd.activeResponse).toBe(secondResponse);
        expect(secondResponse.contains(premise)).toBe(true);

        dnd.dragDropWrapDiv.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
        );
        expect(document.activeElement).toBe(dnd.dragDropWrapDiv);
        expect(dnd.activeResponse).toBe(firstResponse);
        expect(firstResponse.contains(premise)).toBe(true);

        dnd.dragDropWrapDiv.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Tab",
                shiftKey: true,
                bubbles: true,
            }),
        );
        expect(document.activeElement).toBe(dnd.dragDropWrapDiv);
        expect(dnd.activeResponse).toBe(secondResponse);
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
        expect(dnd.keyboardInstructionDiv.textContent).toBe(
            "Returned to unplaced list.",
        );
        expect(dnd.selectedPremise).toBe(premise);
        expect(premise.classList.contains("selected")).toBe(true);
        expect(dnd.responseArray.every((item) => item.tabIndex === 0)).toBe(
            true,
        );
    });

    it("drops a selected premise in the dragzone with Enter after moving left", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const response = dnd.responseArray[0];

        premise.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(response.contains(premise)).toBe(true);

        response.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowLeft",
                bubbles: true,
            }),
        );
        expect(premise.parentElement).toBe(dnd.draggableDiv);

        response.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(premise.parentElement).toBe(dnd.draggableDiv);
        expect(dnd.selectedPremise).toBe(null);
        expect(premise.classList.contains("selected")).toBe(false);
        expect(document.activeElement).toBe(premise);
        expect(dnd.premiseArray.every((item) => item.tabIndex === 0)).toBe(
            true,
        );
        expect(dnd.responseArray.every((item) => item.tabIndex === -1)).toBe(
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
        expect(document.activeElement).toBe(dnd.dragDropWrapDiv);
        expect(dnd.activeResponse).toBe(firstResponse);

        dnd.dragDropWrapDiv.dispatchEvent(
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
    it("drops on the response when the pointer event starts on nested content", async () => {
        const dnd = await makeDnd();
        const premise = dnd.premiseArray[0];
        const response = dnd.responseArray[0];
        const nestedMath = document.createElement("span");
        nestedMath.className = "MathJax";
        response.appendChild(nestedMath);
        const drop = new Event("drop", { bubbles: true, cancelable: true });
        Object.defineProperty(drop, "dataTransfer", {
            value: { getData: () => premise.id },
        });

        nestedMath.dispatchEvent(drop);

        expect(response.contains(premise)).toBe(true);
        expect(drop.defaultPrevented).toBe(true);
    });
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

// The XML PreTeXt writes for a "cardsort" with feedback on cards: the
// exercise <feedback> comes first, then cards that may carry their own
// <feedback>. d3 is a distractor and z2 is a response nothing belongs in.
const CARD_FEEDBACK_XML = `<dragndrop>
  <statement><div class="para">Classify each number.</div></statement>
  <feedback><div class="para">Simplify first.</div></feedback>
  <premise><id>d1</id><label>-7</label></premise>
  <premise><id>d2</id><label>sqrt 16</label><feedback><div class="para">sqrt 16 = 4.</div></feedback></premise>
  <premise><id>d3</id><label>i</label><feedback><div class="para">i is not real.</div></feedback></premise>
  <response><id>z1</id><label>Integer</label><feedback><div class="para">Integers are whole.</div></feedback></response>
  <response><id>z2</id><label>Positive integer less than one</label><feedback><div class="para">Nothing belongs here.</div></feedback></response>
  <answer premise="d1" response="z1"></answer>
  <answer premise="d2" response="z1"></answer>
</dragndrop>`;

// The same question as lxml serializes it into the manifest/database: empty
// elements are self-closing, here an empty exercise <feedback/>.
const CARD_FEEDBACK_XML_SELF_CLOSING = CARD_FEEDBACK_XML.replace(
    '<feedback><div class="para">Simplify first.</div></feedback>',
    "<feedback/>",
).replace(/><\/answer>/g, "/>");

async function makeXmlDnd(xml, id = "test_dnd_xml") {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="dragndrop" id="${id}" data-random="no">
          <script type="text/xml">${xml}</script>
        </div>
      </div>`;
    const dnd = new DragNDrop({
        orig: document.getElementById(id),
        useRunestoneServices: false,
    });
    await dnd.component_ready_promise;
    await tick();
    return dnd;
}

// Three gradeable tries, so feedback that identifies wrong cards is shown.
async function checkThreeTimes(dnd) {
    for (let i = 0; i < 3; i++) {
        dnd.submitButton.click();
        await feedbackSettles();
    }
}

describe("feedback on cards", () => {
    it("reads the exercise feedback, not the first card's, from XML", async () => {
        const dnd = await makeXmlDnd(CARD_FEEDBACK_XML);
        expect(dnd.feedback).toBe('<div class="para">Simplify first.</div>');
        expect(dnd.premiseArray.map((p) => p.id)).toEqual(["d1", "d2", "d3"]);
        expect(Object.keys(dnd.cardFeedback).sort()).toEqual([
            "d2",
            "d3",
            "z1",
            "z2",
        ]);
    });

    it("handles self-closing elements written by an XML serializer", async () => {
        const dnd = await makeXmlDnd(CARD_FEEDBACK_XML_SELF_CLOSING);
        expect(dnd.feedback).toBe("");
        expect(dnd.premiseArray.map((p) => p.id)).toEqual(["d1", "d2", "d3"]);
        expect(dnd.responseArray.map((r) => r.id)).toEqual(["z1", "z2"]);
        const byId = Object.fromEntries(
            dnd.premiseArray.map((p) => [p.id, p.dataset.category]),
        );
        expect(byId).toEqual({ d1: "z1", d2: "z1", d3: "distractor-d3" });
    });

    const infoCards = (dnd) =>
        [...dnd.containerDiv.querySelectorAll(".draggable-card-info")].map(
            (info) => info.dataset.card,
        );
    const popover = (id) => document.getElementById(id + "_info");
    const infoButton = (id) =>
        document.querySelector(
            `.draggable-card-info[data-card="${id}"] > button`,
        );

    it("puts an info button after misplaced cards with feedback after three tries", async () => {
        const dnd = await makeXmlDnd(CARD_FEEDBACK_XML);
        place(dnd, "d1", "z1");
        place(dnd, "d2", "z2");
        place(dnd, "d3", "z2");
        dnd.submitButton.click();
        await feedbackSettles();
        expect(infoCards(dnd)).toEqual([]);
        await checkThreeTimes(dnd);
        // z1 is missing d2, z2 holds cards that don't belong there
        expect(infoCards(dnd).sort()).toEqual(["d2", "d3", "z1", "z2"]);
        // card feedback stays out of the feedback area
        expect(dnd.feedBackDiv.textContent).toContain("Simplify first.");
        expect(dnd.feedBackDiv.textContent).not.toContain("sqrt 16 = 4.");
        expect(popover("d2").textContent).toBe("sqrt 16 = 4.");
        expect(popover("d2").hidden).toBe(true);
    });

    it("makes the info buttons tabbable disclosures outside the card's role=button", async () => {
        const dnd = await makeXmlDnd(CARD_FEEDBACK_XML);
        place(dnd, "d2", "z2");
        place(dnd, "d1", "z1");
        await checkThreeTimes(dnd);
        const d2 = dnd.premiseArray.find((p) => p.id === "d2");
        const button = infoButton("d2");
        // not nested in the card, and right after it in tab order
        expect(d2.contains(button)).toBe(false);
        expect(d2.nextElementSibling.contains(button)).toBe(true);
        expect(button.tabIndex).toBe(0);
        expect(button.getAttribute("aria-label")).toBe("Feedback for sqrt 16");
        expect(button.getAttribute("aria-expanded")).toBe("false");
        expect(button.getAttribute("aria-controls")).toBe("d2_info");
        const z2 = dnd.responseArray.find((r) => r.id === "z2");
        expect(z2.contains(infoButton("z2"))).toBe(false);
        expect(z2.previousElementSibling.contains(infoButton("z2"))).toBe(true);
        expect(infoButton("z2").getAttribute("aria-label")).toBe(
            "Feedback for Positive integer less than one",
        );
        // the card's own accessible name is unchanged
        expect(d2.getAttribute("aria-label")).not.toContain("Feedback");
        button.click();
        expect(button.getAttribute("aria-expanded")).toBe("true");
    });

    it("opens one popover at a time and closes it on an outside click or Escape", async () => {
        const dnd = await makeXmlDnd(CARD_FEEDBACK_XML);
        place(dnd, "d2", "z2");
        place(dnd, "d3", "z2");
        await checkThreeTimes(dnd);
        infoButton("d2").click();
        expect(popover("d2").hidden).toBe(false);
        infoButton("z1").click();
        expect(popover("d2").hidden).toBe(true);
        expect(popover("z1").hidden).toBe(false);
        document.body.click();
        expect(popover("z1").hidden).toBe(true);
        infoButton("d3").click();
        infoButton("d3").focus();
        infoButton("d3").dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        expect(popover("d3").hidden).toBe(true);
        expect(infoButton("d3").getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(infoButton("d3"));
    });

    it("does not place a selected premise when a response's info button is clicked", async () => {
        const dnd = await makeXmlDnd(CARD_FEEDBACK_XML);
        place(dnd, "d2", "z2");
        place(dnd, "d1", "z1");
        await checkThreeTimes(dnd);
        const d3 = dnd.premiseArray.find((p) => p.id === "d3");
        dnd.selectPremise(d3);
        const before = d3.parentElement;
        infoButton("z2").click();
        expect(d3.parentElement).toBe(before);
        expect(popover("z2").hidden).toBe(false);
    });

    it("drops a premise's feedback when the premise is moved", async () => {
        const dnd = await makeXmlDnd(CARD_FEEDBACK_XML);
        place(dnd, "d2", "z2");
        place(dnd, "d1", "z1");
        await checkThreeTimes(dnd);
        const d2 = dnd.premiseArray.find((p) => p.id === "d2");
        dnd.selectPremise(d2);
        dnd.moveSelectedPremise(dnd.draggableDiv, "dragzone");
        expect(infoCards(dnd)).not.toContain("d2");
        expect(d2.classList.contains("has-card-info")).toBe(false);
    });

    it("grades the same with info controls in the columns", async () => {
        const dnd = await makeXmlDnd(CARD_FEEDBACK_XML);
        place(dnd, "d2", "z2");
        place(dnd, "d1", "z1");
        await checkThreeTimes(dnd);
        const counts = [dnd.correctNum, dnd.incorrectNum, dnd.unansweredNum];
        expect(infoCards(dnd)).toContain("z1");
        dnd.checkCurrentAnswer();
        expect([dnd.correctNum, dnd.incorrectNum, dnd.unansweredNum]).toEqual(
            counts,
        );
        expect(dnd.getAllCategories()).toEqual(["z1", "z2"]);
        dnd.setLocalStorage({ correct: "F" });
        expect(dnd.answerState).toEqual({ z1: ["d1"], z2: ["d2"] });
    });

    it("removes the info buttons on reset and when the answer is fixed", async () => {
        const dnd = await makeXmlDnd(CARD_FEEDBACK_XML);
        place(dnd, "d2", "z2");
        place(dnd, "d1", "z1");
        await checkThreeTimes(dnd);
        expect(infoCards(dnd).length).toBeGreaterThan(0);
        place(dnd, "d2", "z1");
        dnd.submitButton.click();
        await feedbackSettles();
        expect(infoCards(dnd)).toEqual([]);
        expect(document.getElementById("d2_info")).toBe(null);
        place(dnd, "d2", "z2");
        await checkThreeTimes(dnd);
        dnd.resetButton.click();
        expect(infoCards(dnd)).toEqual([]);
    });

    it("reads card feedback from the JSON representation", async () => {
        const question = {
            ...JSON_QUESTION,
            left: [
                { id: "p1", label: "Dog" },
                { id: "p2", label: "Cat", feedback: "Cats meow." },
                { id: "p3", label: "Rock" },
            ],
        };
        const dnd = await makeDnd({ question });
        place(dnd, "p1", "r2");
        place(dnd, "p2", "r1");
        await checkThreeTimes(dnd);
        expect(infoCards(dnd)).toEqual(["p2"]);
        expect(popover("p2").textContent).toBe("Cats meow.");
    });
});
