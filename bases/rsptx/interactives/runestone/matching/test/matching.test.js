import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MatchingProblem } from "../js/matching.js";

const MATCHING_QUESTION = {
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
        { id: "r3", label: "Silence" },
    ],
    correctAnswers: [
        ["p1", "r1"],
        ["p2", "r2"],
    ],
};

function makeFixture({
    id = "test_matching_1",
    question = MATCHING_QUESTION,
} = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="matching" id="${id}">
          <script type="application/json">${JSON.stringify(question)}</script>
        </div>
      </div>`;
    return document.getElementById(id);
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function makeMatching(fixtureOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    const matching = new MatchingProblem({ orig });
    await matching.boxesRenderedPromise;
    await tick();
    return matching;
}

function keydown(target, key, extra = {}) {
    target.dispatchEvent(
        new KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
            ...extra,
        }),
    );
}

function renderMathSpeech(element, speech) {
    const math = element.querySelector(".process-math") || element;
    math.innerHTML =
        '<mjx-container data-semantic-speech-none="' +
        speech +
        '"><mjx-math aria-hidden="true">ignored</mjx-math></mjx-container>';
}

beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    vi.stubGlobal("alert", vi.fn());
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("matching keyboard controls", () => {
    it("removes math content inside boxes from the tab order", async () => {
        const matching = await makeMatching();
        const box = matching.leftColumn.querySelector(".box");
        const nestedMath = document.createElement("span");
        const nestedMathChild = document.createElement("span");
        nestedMath.className = "MathJax";
        nestedMath.tabIndex = 0;
        nestedMathChild.tabIndex = 0;
        nestedMath.appendChild(nestedMathChild);
        box.appendChild(nestedMath);

        matching.disableBoxMathTabStops();

        expect(nestedMath.tabIndex).toBe(-1);
        expect(nestedMathChild.tabIndex).toBe(-1);
    });

    it("uses MathJax speech for box and connection labels", async () => {
        const matching = await makeMatching({
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
                        label: 'Derivative <span class="process-math">\(2x\)</span>',
                    },
                ],
                correctAnswers: [["p1", "r1"]],
            },
        });
        const leftBox = matching.leftColumn.querySelector(".box");
        const rightBox = matching.rightColumn.querySelector(".box");

        renderMathSpeech(leftBox, "x squared");
        renderMathSpeech(rightBox, "two x");
        matching.updateBoxAriaLabels();

        expect(leftBox.getAttribute("aria-label")).toBe("Draggable: x squared");
        expect(rightBox.getAttribute("aria-label")).toBe(
            "Droppable: Derivative two x",
        );

        keydown(leftBox, "Enter");
        expect(matching.ariaLive.textContent).toBe(
            "Selected x squared. Tab to a box in the other column and press Enter to connect, or press Escape to cancel.",
        );

        keydown(rightBox, "Enter");
        const line = matching.connections[0].line;
        expect(line.getAttribute("aria-label")).toBe(
            "Connection from x squared to Derivative two x. Press Enter, Delete, or Backspace to remove.",
        );
        expect(matching.ariaLive.textContent).toBe(
            "Connected x squared to Derivative two x",
        );
        const connectionEntry = matching.connList.querySelector(".conn-entry");
        expect(
            [...connectionEntry.querySelectorAll(".visuallyhidden")].map(
                (element) => element.textContent,
            ),
        ).toEqual(["x squared", "connected to", "Derivative two x"]);
        const visualMath = connectionEntry.querySelectorAll(
            '[aria-hidden="true"] mjx-container',
        );
        expect(visualMath).toHaveLength(2);
        expect(visualMath[0].getAttribute("data-semantic-speech-none")).toBe(
            "x squared",
        );
        expect(visualMath[1].getAttribute("data-semantic-speech-none")).toBe(
            "two x",
        );
    });

    it("refreshes connection labels when MathJax speech becomes available", async () => {
        const matching = await makeMatching({
            question: {
                statement: "Match the function.",
                left: [
                    {
                        id: "p1",
                        label: '<span class="process-math"></span>',
                    },
                ],
                right: [{ id: "r1", label: "Derivative" }],
                correctAnswers: [["p1", "r1"]],
            },
        });
        const leftBox = matching.leftColumn.querySelector(".box");
        const rightBox = matching.rightColumn.querySelector(".box");
        const math = leftBox.querySelector(".process-math");
        const mathContainer = document.createElement("mjx-container");

        keydown(leftBox, "Enter");
        keydown(rightBox, "Enter");
        matching.gradeConnections();

        math.appendChild(mathContainer);
        mathContainer.setAttribute("data-semantic-speech-none", "x squared");
        await tick();

        expect(leftBox.getAttribute("aria-label")).toBe(
            "Draggable: x squared, correct",
        );
        expect(matching.connections[0].line.getAttribute("aria-label")).toBe(
            "Connection from x squared to Derivative. Press Enter, Delete, or Backspace to remove.",
        );
        expect(
            [...matching.connList.querySelectorAll(".visuallyhidden")].map(
                (element) => element.textContent,
            ),
        ).toEqual(["x squared", "connected to", "Derivative"]);
        expect(matching.feedbackDiv.hidden).toBe(false);
        expect(leftBox.classList.contains("match-correct")).toBe(true);
        expect(matching.connections[0].line.classList.contains("correct")).toBe(
            true,
        );
    });

    it("only keeps right boxes tabbable while a left box is active", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];
        const rightBoxes = [...matching.rightColumn.querySelectorAll(".box")];

        keydown(leftBoxes[0], "Enter");

        expect(matching.selectedBox).toBe(leftBoxes[0]);
        expect(matching.activeBoxRole).toBe("drag");
        expect(matching.ariaLive.textContent).toBe(
            "Selected Dog. Tab to a box in the other column and press Enter to connect, or press Escape to cancel.",
        );
        expect(leftBoxes.every((box) => box.tabIndex === -1)).toBe(true);
        expect(rightBoxes.every((box) => box.tabIndex === 0)).toBe(true);
        expect(document.activeElement).toBe(rightBoxes[0]);
    });

    it("only keeps left boxes tabbable while a right box is active", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];
        const rightBoxes = [...matching.rightColumn.querySelectorAll(".box")];

        keydown(rightBoxes[1], "Enter");

        expect(matching.selectedBox).toBe(rightBoxes[1]);
        expect(matching.activeBoxRole).toBe("drop");
        expect(leftBoxes.every((box) => box.tabIndex === 0)).toBe(true);
        expect(rightBoxes.every((box) => box.tabIndex === -1)).toBe(true);
        expect(document.activeElement).toBe(leftBoxes[0]);
    });

    it("traps Tab within the opposite column while a box is active", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];
        const rightBoxes = [...matching.rightColumn.querySelectorAll(".box")];

        keydown(leftBoxes[0], "Enter");
        expect(document.activeElement).toBe(rightBoxes[0]);

        keydown(rightBoxes[0], "Tab");
        expect(document.activeElement).toBe(rightBoxes[1]);

        keydown(rightBoxes[1], "Tab", { shiftKey: true });
        expect(document.activeElement).toBe(rightBoxes[0]);
    });

    it("cancels an active box with Escape and announces the cancellation", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];

        keydown(leftBoxes[0], "Enter");
        keydown(document.activeElement, "Escape");

        expect(matching.selectedBox).toBe(null);
        expect(matching.activeBoxRole).toBe(null);
        expect(matching.allBoxes.every((box) => box.tabIndex === 0)).toBe(true);
        expect(document.activeElement).toBe(leftBoxes[0]);
        expect(matching.ariaLive.textContent).toBe("Selection cancelled.");
    });

    it("moves focus vertically within the current column", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];

        leftBoxes[0].focus();
        keydown(leftBoxes[0], "ArrowDown");
        expect(document.activeElement).toBe(leftBoxes[1]);

        keydown(leftBoxes[1], "ArrowUp");
        expect(document.activeElement).toBe(leftBoxes[0]);
    });

    it("moves focus to the first box in the left or right column", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];
        const rightBoxes = [...matching.rightColumn.querySelectorAll(".box")];

        leftBoxes[1].focus();
        keydown(leftBoxes[1], "ArrowRight");
        expect(document.activeElement).toBe(rightBoxes[0]);

        keydown(rightBoxes[0], "ArrowLeft");
        expect(document.activeElement).toBe(leftBoxes[0]);
    });

    it("creates a connection and restores all box tab stops", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];
        const rightBoxes = [...matching.rightColumn.querySelectorAll(".box")];

        keydown(leftBoxes[0], "Enter");
        keydown(rightBoxes[1], "Enter");

        expect(matching.connections).toHaveLength(1);
        expect(matching.connections[0].fromBox).toBe(leftBoxes[0]);
        expect(matching.connections[0].toBox).toBe(rightBoxes[1]);
        expect(matching.selectedBox).toBe(null);
        expect(matching.activeBoxRole).toBe(null);
        expect(matching.allBoxes.every((box) => box.tabIndex === 0)).toBe(true);
        expect(document.activeElement).toBe(rightBoxes[1]);
    });

    it("selects a formed connection and removes it with Enter", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];
        const rightBoxes = [...matching.rightColumn.querySelectorAll(".box")];

        keydown(leftBoxes[0], "Enter");
        keydown(rightBoxes[1], "Enter");
        const line = matching.connections[0].line;

        line.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        expect(matching.connections).toHaveLength(1);
        expect(matching.selectedLine).toBe(line);
        expect(line.classList.contains("selected")).toBe(true);
        expect(matching.ariaLive.textContent).toBe(
            "Selected connection from Dog to Meows. Press Enter to delete it.",
        );

        keydown(line, "Enter");
        expect(matching.connections).toHaveLength(0);
        expect(matching.selectedLine).toBe(null);
        expect(matching.svg.contains(line)).toBe(false);
        expect(matching.ariaLive.textContent).toBe(
            "Removed connection from Dog to Meows.",
        );
    });

    it("selects and connects boxes with click events", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];
        const rightBoxes = [...matching.rightColumn.querySelectorAll(".box")];

        leftBoxes[0].click();
        expect(matching.selectedBox).toBe(leftBoxes[0]);
        expect(matching.activeBoxRole).toBe("drag");
        expect(document.activeElement).toBe(rightBoxes[0]);

        rightBoxes[1].click();
        expect(matching.connections).toHaveLength(1);
        expect(matching.connections[0].fromBox).toBe(leftBoxes[0]);
        expect(matching.connections[0].toBox).toBe(rightBoxes[1]);
        expect(matching.selectedBox).toBe(null);
        expect(matching.allBoxes.every((box) => box.tabIndex === 0)).toBe(true);
    });

    it("activates the box when clicking nested content", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];
        const rightBoxes = [...matching.rightColumn.querySelectorAll(".box")];
        const nestedContent = document.createElement("span");
        nestedContent.textContent = " nested";
        leftBoxes[0].appendChild(nestedContent);

        nestedContent.click();
        expect(matching.selectedBox).toBe(leftBoxes[0]);

        rightBoxes[0].click();
        expect(matching.connections).toHaveLength(1);
        expect(matching.connections[0].fromBox).toBe(leftBoxes[0]);
        expect(matching.connections[0].toBox).toBe(rightBoxes[0]);
    });

    it("shows live feedback after checking and hides it after an edit", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];
        const rightBoxes = [...matching.rightColumn.querySelectorAll(".box")];

        expect(matching.feedbackDiv.hidden).toBe(true);
        expect(matching.feedbackDiv.getAttribute("role")).toBe("status");
        expect(matching.feedbackDiv.getAttribute("aria-live")).toBe("polite");
        expect(matching.feedbackDiv.previousElementSibling).toBe(
            matching.connList,
        );

        leftBoxes[0].click();
        rightBoxes[0].click();
        expect(matching.feedbackDiv.hidden).toBe(true);

        matching.gradeConnections();
        expect(matching.feedbackDiv.hidden).toBe(false);
        expect(matching.feedbackDiv.textContent).toContain("Score:");
        expect(matching.connList.querySelector(".conn-entry")).not.toBe(null);

        const restored = await makeMatching();
        expect(restored.feedbackDiv.hidden).toBe(true);

        keydown(matching.connections[0].line, "Enter");
        expect(matching.feedbackDiv.hidden).toBe(true);
        expect(matching.feedbackDiv.textContent).toBe("");
    });

    it("updates box labels for grading states and connection edits", async () => {
        const matching = await makeMatching();
        const boxes = [...matching.allBoxes];
        const premise = boxes.find((box) => box.dataset.id === "p1");
        const correctResponse = boxes.find((box) => box.dataset.id === "r1");
        const incorrectResponse = boxes.find((box) => box.dataset.id === "r2");

        premise.click();
        correctResponse.click();
        matching.gradeConnections();
        expect(premise.getAttribute("aria-label")).toBe(
            "Draggable: Dog, correct",
        );
        expect(correctResponse.getAttribute("aria-label")).toBe(
            "Droppable: Barks, correct",
        );

        keydown(matching.connections[0].line, "Enter");
        expect(premise.getAttribute("aria-label")).toBe("Draggable: Dog");
        expect(correctResponse.getAttribute("aria-label")).toBe(
            "Droppable: Barks",
        );

        premise.click();
        incorrectResponse.click();
        matching.gradeConnections();
        expect(premise.getAttribute("aria-label")).toBe(
            "Draggable: Dog, incorrect",
        );
        expect(incorrectResponse.getAttribute("aria-label")).toBe(
            "Droppable: Meows, incorrect",
        );

        matching.resetConnections();
        expect(premise.getAttribute("aria-label")).toBe("Draggable: Dog");
        expect(incorrectResponse.getAttribute("aria-label")).toBe(
            "Droppable: Meows",
        );
    });

    it("opens help in a dismissible live dialog", async () => {
        const matching = await makeMatching();
        const dialog = matching.helpModal;
        const closeButton = dialog.querySelector(".help-close");
        dialog.showModal = vi.fn(function () {
            this.setAttribute("open", "");
        });
        dialog.close = vi.fn(function () {
            this.removeAttribute("open");
            this.dispatchEvent(new Event("close"));
        });

        expect(dialog.tagName).toBe("DIALOG");
        expect(dialog.getAttribute("aria-live")).toBe("polite");
        expect(closeButton.getAttribute("aria-label")).toBe(
            "Close matching help",
        );

        matching.helpBtn.click();
        expect(dialog.showModal).toHaveBeenCalledOnce();
        expect(dialog.open).toBe(true);

        const cancel = new Event("cancel", { cancelable: true });
        dialog.dispatchEvent(cancel);
        expect(cancel.defaultPrevented).toBe(true);
        expect(dialog.close).toHaveBeenCalledOnce();

        matching.showHelp();
        dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(dialog.close).toHaveBeenCalledTimes(2);
    });
});
