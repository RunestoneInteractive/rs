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

function makeFixture({ id = "test_matching_1", question = MATCHING_QUESTION } = {}) {
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

    it("only keeps right boxes tabbable while a left box is active", async () => {
        const matching = await makeMatching();
        const leftBoxes = [...matching.leftColumn.querySelectorAll(".box")];
        const rightBoxes = [...matching.rightColumn.querySelectorAll(".box")];

        keydown(leftBoxes[0], "Enter");

        expect(matching.selectedBox).toBe(leftBoxes[0]);
        expect(matching.activeBoxRole).toBe("drag");
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
});