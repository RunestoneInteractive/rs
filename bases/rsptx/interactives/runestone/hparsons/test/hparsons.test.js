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

    it("ignores stray whitespace in data-blockanswer", () => {
        const hp = makeComponent({
            blocks: ["a", "b", "c"].join("\n"),
            blockAnswer: "  0  1 2 ",
        });
        expect(hp.blockAnswer).toEqual(["0", "1", "2"]);
        expect(gradeOf(hp, [0, 1, 2])).toBe("correct");
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
    });
});
