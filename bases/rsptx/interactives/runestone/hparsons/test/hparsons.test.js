// Tests for the horizontal (micro) Parsons component's block-based grader.
// Note: deliberately NO jquery-globals import here -- hparsons must work
// without jQuery.
import { describe, it, expect, beforeEach, vi } from "vitest";
import HParsons from "../js/hparsons.js";

// Build the DOM a book page provides: div.runestone > [data-component=hparsons]
// wrapping a textarea whose text holds the --blocks-- section. data-blockanswer
// is a space separated list of indexes into that block list.
function makeFixture({
    id = "test_hparsons_1",
    blocks,
    blockAnswer,
    attrs = "",
} = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="hparsons" id="${id}">
          <div class="hp_question"><p>Build the query.</p></div>
          <textarea data-blockanswer="${blockAnswer}" data-randomize="false" ${attrs}>
--blocks--
${blocks}
--end--
</textarea>
        </div>
      </div>`;
    return document.getElementById(id);
}

function makeComponent(opts) {
    return new HParsons({
        orig: makeFixture(opts),
        useRunestoneServices: false,
    });
}

// Put blocks into the answer area in the given order by clicking them in the
// drag area, the same path a student's clicks take.
function answerWith(hp, indexes) {
    hp.hparsonsInput.restoreAnswerByIndices(indexes);
    return hp.hparsonsInput.getBlockIndices();
}

function gradeOf(hp, indexes) {
    answerWith(hp, indexes);
    hp.feedbackController.checkCurrentAnswer();
    return hp.feedbackController.grade;
}

// A SELECT with two "=" blocks -- the shape from issue #1194. Indexes 2 and 5
// hold identical content, so either may fill either "=" slot.
const DUPLICATE_BLOCKS = [
    "SELECT *",
    "FROM a JOIN b ON a.id",
    "=",
    "b.a_id",
    "WHERE a.kind",
    "=",
    "'x'",
].join("\n");

// Math blocks render through MathJax, which rewrites the text in the DOM.
const MATH_BLOCKS = [
    '<span class="process-math">\\(x\\)</span>',
    '<span class="process-math">\\(+\\)</span>',
    '<span class="process-math">\\(y\\)</span>',
].join("\n");

describe("HParsons block grading", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        // MathJax is not loaded in tests; queueMathJax is a no-op stub.
        vi.spyOn(HParsons.prototype, "queueMathJax").mockImplementation(
            () => {},
        );
        vi.spyOn(HParsons.prototype, "logBookEvent").mockResolvedValue({});
        vi.spyOn(HParsons.prototype, "checkServer").mockImplementation(
            () => {},
        );
    });

    it("grades the authored order correct", () => {
        const hp = makeComponent({
            blocks: DUPLICATE_BLOCKS,
            blockAnswer: "0 1 2 3 4 5 6",
        });
        expect(gradeOf(hp, [0, 1, 2, 3, 4, 5, 6])).toBe("correct");
    });

    // Issue #1194: the two "=" blocks are interchangeable, so swapping them
    // must still grade correct even though the block indexes differ.
    it("accepts interchangeable blocks with identical content", () => {
        const hp = makeComponent({
            blocks: DUPLICATE_BLOCKS,
            blockAnswer: "0 1 2 3 4 5 6",
        });
        expect(gradeOf(hp, [0, 1, 5, 3, 4, 2, 6])).toBe("correct");
        expect(hp.feedbackController.grader.percent).toBe(1);
    });

    it("still rejects blocks in the wrong order", () => {
        const hp = makeComponent({
            blocks: DUPLICATE_BLOCKS,
            blockAnswer: "0 1 2 3 4 5 6",
        });
        expect(gradeOf(hp, [1, 0, 2, 3, 4, 5, 6])).toBe("incorrectMoveBlocks");
    });

    it("reports a short answer as too short", () => {
        const hp = makeComponent({
            blocks: DUPLICATE_BLOCKS,
            blockAnswer: "0 1 2 3 4 5 6",
        });
        expect(gradeOf(hp, [0, 1, 2])).toBe("incorrectTooShort");
    });

    // Reuse lets one source block appear several times in the answer, so the
    // solution names the same index more than once.
    it("grades a block reused in several places", () => {
        const reuseProblem = {
            blocks: ["a", "+", "b"].join("\n"),
            blockAnswer: "0 1 2 1 0",
            attrs: 'data-reuse="true"',
        };
        const hp = makeComponent(reuseProblem);
        expect(hp.reuse).toBe(true);
        expect(gradeOf(hp, [0, 1, 2, 1, 0])).toBe("correct");
        // A fresh component: once solved, checkCurrentAnswer stops grading.
        expect(gradeOf(makeComponent(reuseProblem), [0, 1, 2, 1])).toBe(
            "incorrectTooShort",
        );
    });

    // Grading reads the authored source text, so it does not matter that
    // MathJax rewrites what the rendered block says.
    it("grades math blocks after the DOM text has been rewritten", () => {
        const hp = makeComponent({
            blocks: MATH_BLOCKS,
            blockAnswer: "0 1 2",
        });
        expect(hp.language).toBe("math");
        answerWith(hp, [0, 1, 2]);
        // Simulate MathJax replacing the block contents with rendered output.
        hp.hparsonsInput
            .querySelectorAll(".drop-area .parsons-block")
            .forEach((block) => {
                block.innerHTML = "<mjx-container>rendered</mjx-container>";
            });
        hp.feedbackController.checkCurrentAnswer();
        expect(hp.feedbackController.grade).toBe("correct");
    });

    it("pre-renders math blocks without MathJax tab stops", async () => {
        const hp = makeComponent({
            blocks: MATH_BLOCKS,
            blockAnswer: "0 1 2",
        });
        // Allow the initial deferred MathJax render to finish first.
        await new Promise((resolve) => setTimeout(resolve, 20));
        const block = hp.hparsonsInput.querySelector(".parsons-block");
        hp.queueMathJax.mockImplementationOnce((mathBlock) => {
            mathBlock.innerHTML = `
            <mjx-container aria-label="x squared" tabindex="0">
                <span tabindex="0">visual math internals</span>
            </mjx-container>`;
            return Promise.resolve();
        });

        await hp.renderMathInBlocks();

        const math = block.querySelector("mjx-container");
        expect(math.tabIndex).toBe(-1);
        expect(math.querySelector("span").tabIndex).toBe(-1);

        const lateMath = document.createElement("mjx-container");
        lateMath.tabIndex = 0;
        block.appendChild(lateMath);
        await new Promise((resolve) => setTimeout(resolve));

        expect(lateMath.tabIndex).toBe(-1);
    });

    it("waits for queued MathJax block renders", async () => {
        const hp = makeComponent({
            blocks: MATH_BLOCKS,
            blockAnswer: "0 1 2",
        });
        await new Promise((resolve) => setTimeout(resolve, 20));

        let completeRender;
        hp.queueMathJax.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    completeRender = resolve;
                }),
        );
        const render = hp.renderMathInBlocks();
        let resolved = false;
        render.then(() => {
            resolved = true;
        });

        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(resolved).toBe(false);
        completeRender();
        await render;
        expect(resolved).toBe(true);
    });

    it("announces block-grading feedback through a persistent status region", async () => {
        const hp = makeComponent({
            blocks: ["first", "second"].join("\n"),
            blockAnswer: "0 1",
        });

        const liveRegion = hp.feedbackController.feedbackLiveRegion;
        expect(liveRegion.getAttribute("role")).toBe(
            "status",
        );
        expect(liveRegion.getAttribute("aria-live")).toBe("polite");
        expect(liveRegion.getAttribute("aria-atomic")).toBe("true");

        await hp.feedbackController.runButtonHandler();
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(liveRegion.textContent).toBe(
            hp.feedbackController.messageDiv.textContent,
        );
    });

    it("cancels feedback that is cleared before it can be announced", async () => {
        const hp = makeComponent({
            blocks: ["first", "second"].join("\n"),
            blockAnswer: "0 1",
        });

        hp.feedbackController.announceFeedback("Incorrect order.");
        hp.feedbackController.clearFeedback();
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(hp.feedbackController.feedbackLiveRegion.textContent).toBe("");
    });

    it("announces when the block arrangement is reset", async () => {
        const hp = makeComponent({
            blocks: ["first", "second"].join("\n"),
            blockAnswer: "0 1",
        });

        hp.feedbackController.reset();
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(hp.feedbackController.feedbackLiveRegion.textContent).toBe(
            "Blocks reset.",
        );
    });

    it("ignores stray whitespace in data-blockanswer", () => {
        const hp = makeComponent({
            blocks: ["a", "b", "c"].join("\n"),
            blockAnswer: "  0  1 2 ",
        });
        expect(hp.blockAnswer).toEqual(["0", "1", "2"]);
        expect(gradeOf(hp, [0, 1, 2])).toBe("correct");
    });
});

describe("HParsons keyboard movement surface", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        vi.spyOn(HParsons.prototype, "queueMathJax").mockResolvedValue({});
        vi.spyOn(HParsons.prototype, "logBookEvent").mockResolvedValue({});
        vi.spyOn(HParsons.prototype, "checkServer").mockImplementation(
            () => {},
        );
    });

    it("uses one Tab stop and moves blocks only after activation", () => {
        const hp = makeComponent({
            blocks: ["first", "second", "third"].join("\n"),
            blockAnswer: "0 1 2",
        });
        const input = hp.hparsonsInput.querySelector(".hparsons-input");
        const blocks = input.querySelectorAll(".parsons-block");

        expect(input.tabIndex).toBe(0);
        expect(input.getAttribute("role")).toBe("button");
        expect(input.getAttribute("aria-pressed")).toBe("false");
        expect(Array.from(blocks).every((block) => block.tabIndex === -1)).toBe(
            true,
        );

        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(input.getAttribute("role")).toBe("application");
        expect(input.getAttribute("aria-activedescendant")).toBe(blocks[0].id);
        expect(document.activeElement).toBe(blocks[0]);

        blocks[0].dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        );
        expect(input.getAttribute("aria-activedescendant")).toBe(blocks[1].id);
        expect(document.activeElement).toBe(blocks[1]);

        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
        expect(input.getAttribute("aria-activedescendant")).toBe(blocks[1].id);

        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
        );
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(hp.hparsonsInput.getBlockIndices()).toEqual([0]);

        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
        );
        expect(input.getAttribute("aria-activedescendant")).toBe(blocks[1].id);

        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        );
        expect(input.getAttribute("aria-activedescendant")).toBe(blocks[2].id);

        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
        );
        expect(input.getAttribute("aria-activedescendant")).toBe(blocks[0].id);

        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        expect(input.getAttribute("role")).toBe("button");
        expect(input.getAttribute("aria-pressed")).toBe("false");
        expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    });

    it("refocuses the movement surface on the block clicked in movement mode", () => {
        const hp = makeComponent({
            blocks: ["first", "second"].join("\n"),
            blockAnswer: "0 1",
        });
        const input = hp.hparsonsInput.querySelector(".hparsons-input");
        const firstBlock = input.querySelector(".parsons-block");

        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        firstBlock.click();

        expect(document.activeElement).toBe(firstBlock);
        expect(input.getAttribute("aria-activedescendant")).toBe(firstBlock.id);
        expect(firstBlock.parentElement.classList.contains("drop-area")).toBe(
            true,
        );
    });
});
describe("HParsons wrong-order feedback", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        vi.spyOn(HParsons.prototype, "queueMathJax").mockImplementation(
            () => {},
        );
        vi.spyOn(HParsons.prototype, "logBookEvent").mockResolvedValue({});
        vi.spyOn(HParsons.prototype, "checkServer").mockImplementation(
            () => {},
        );
    });

    // Marking is by content too, so an interchangeable block never gets
    // flagged just because it carries a different index than the solution.
    it("flags only the blocks that are actually out of place", () => {
        const hp = makeComponent({
            blocks: DUPLICATE_BLOCKS,
            blockAnswer: "0 1 2 3 4 5 6",
        });
        // Swap the two "=" blocks (harmless) and also move "SELECT *" to the
        // end (the real mistake).
        answerWith(hp, [1, 5, 3, 4, 2, 6, 0]);
        hp.feedbackController.checkCurrentAnswer();
        hp.feedbackController.renderFeedback();
        const flagged = Array.from(
            hp.hparsonsInput.querySelectorAll(
                ".drop-area .parsons-block.incorrectPosition",
            ),
        ).map((block) => block.dataset.index);
        expect(flagged).toEqual(["0"]);
        expect(
            hp.hparsonsInput.querySelector(
                ".drop-area .parsons-block.incorrectPosition",
            ).getAttribute("aria-label"),
        ).toContain("incorrect");
    });
});
