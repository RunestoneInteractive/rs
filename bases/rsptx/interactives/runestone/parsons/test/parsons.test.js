// Characterization tests for the Parsons component. These were first written
// against the jQuery implementation and now guard the jQuery-free version.
// Note: deliberately NO jquery-globals import here -- parsons must work
// without jQuery.
import { describe, it, expect, beforeEach, vi } from "vitest";
import Parsons from "../js/parsons.js";
import "../js/timedparsons.js";
import { setLocale } from "../../common/js/rsi18n.js";

// Build the same DOM a book page provides (see parsonsPreview.tsx and the
// Sphinx/PreTeXt templates): div.runestone > [data-component=parsons] with a
// question div and a pre.parsonsblocks holding the block source text.
function makeFixture({
    id = "test_parsons_1",
    blocks,
    attrs = "",
    question = "<p>Arrange the code.</p>",
} = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="parsons" id="${id}" class="parsons">
          <div class="parsons_question">${question}</div>
          <pre class="parsonsblocks" data-question_label="1" ${attrs}>
${blocks}
          </pre>
        </div>
      </div>`;
    return document.getElementById(id);
}

// data-order pins block order so tests are deterministic (no shuffling).
const FLAT_BLOCKS = "line_a = 1\n---\nline_b = 2\n---\nline_c = 3";
const FLAT_ATTRS = 'data-language="python" data-order="0,1,2"';

const INDENTED_BLOCKS =
    'def main():\n---\n    print("Hello")\n---\n    print("Bye") #distractor: not needed';
const INDENTED_ATTRS = 'data-language="python" data-order="0,1,2"';

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function makeParsons(fixtureOpts = {}, extraOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    const parsons = new Parsons({
        orig: orig,
        useRunestoneServices: false,
        ...extraOpts,
    });
    await parsons.component_ready_promise;
    await tick();
    return parsons;
}

// Place source blocks (by their current source-area position) into the answer
// area the way a drag would: answerBlocks()/sourceBlocks() read the DOM.
function answer(parsons, sourceIndexes) {
    const blocks = parsons.sourceBlocks();
    for (const i of sourceIndexes) {
        parsons.answerArea.appendChild(blocks[i].view);
    }
}

beforeEach(() => {
    setLocale("en");
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
    vi.stubGlobal("alert", vi.fn());
});

describe("construction", () => {
    it("replaces the pre with a rendered view holding source/answer areas", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        expect(p.divid).toBe("test_parsons_1");
        expect(p.outerDiv.classList.contains("parsons")).toBe(true);
        // The original pre.parsonsblocks is gone from the document.
        expect(document.querySelector("pre.parsonsblocks")).toBeNull();
        // Areas exist in the document with derived ids.
        expect(document.getElementById(`${p.counterId}-source`)).toBe(
            p.sourceArea,
        );
        expect(document.getElementById(`${p.counterId}-answer`)).toBe(
            p.answerArea,
        );
        expect(p.sourceArea.getAttribute("aria-describedby")).toBe(
            `${p.counterId}-sourceTip`,
        );
    });

    it("creates Check and Reset buttons; Help only when adaptive", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        expect(p.checkButton.textContent).toBe("Check");
        expect(p.checkButton.type).toBe("button");
        expect(p.resetButton.textContent).toBe("Reset");
        expect(p.helpButton).toBeUndefined();

        const adaptive = await makeParsons({
            id: "test_parsons_adaptive",
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + ' data-adaptive="true"',
        });
        expect(adaptive.helpButton.textContent).toBe("Help me");
    });

    it("renders drag labels and a hidden keyboard tip", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        expect(p.sourceLabel.textContent).toBe("Drag from here");
        expect(p.answerLabel.textContent).toBe("Drop blocks here");
        expect(p.keyboardTip.textContent).toContain("Arrow keys to navigate");
        expect(p.keyboardTip.style.display).toBe("none");
    });

    it("shows the keyboard entry hint only for focus-visible focus", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        vi.spyOn(p.sortContainerDiv, "matches").mockImplementation(
            (selector) => selector === ":focus-visible",
        );

        p.sortContainerDiv.focus();
        expect(p.sourceLabel.style.display).toBe("none");
        expect(p.answerLabel.style.display).toBe("none");
        expect(p.keyboardTip.textContent).toBe("Enter to activate");
        expect(p.keyboardTip.style.display).not.toBe("none");

        p.sortContainerDiv.blur();
        expect(p.sourceLabel.style.display).not.toBe("none");
        expect(p.answerLabel.style.display).not.toBe("none");
        expect(p.keyboardTip.textContent).toContain("Arrow keys to navigate");
        expect(p.keyboardTip.style.display).toBe("none");
    });

    it("does not show the keyboard entry hint for mouse focus", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        vi.spyOn(p.sortContainerDiv, "matches").mockReturnValue(false);

        p.sortContainerDiv.focus();
        expect(p.sourceLabel.style.display).not.toBe("none");
        expect(p.answerLabel.style.display).not.toBe("none");
        expect(p.keyboardTip.style.display).toBe("none");
    });

    it("moves the question above the problem; drops a blank question", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        expect(p.outerDiv.firstElementChild).toBe(p.question);
        expect(p.question.textContent).toContain("Arrange the code.");

        const blank = await makeParsons({
            id: "test_parsons_blank_q",
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS,
            question: "   ",
        });
        expect(document.contains(blank.question)).toBe(false);
    });

    it("starts with all blocks in the source area and none answered", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        expect(p.blocks).toHaveLength(3);
        expect(p.sourceBlocks()).toHaveLength(3);
        expect(p.answerBlocks()).toHaveLength(0);
        for (const block of p.sourceBlocks()) {
            expect(block.view.classList.contains("block")).toBe(true);
        }
    });

    it("marks the component ready and adds a caption", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        expect(
            p.containerDiv.classList.contains("runestone-component-ready"),
        ).toBe(true);
        const cap = p.containerDiv.querySelector("p.runestone_caption");
        expect(cap.textContent).toContain("Parsons");
    });

    it("uses MathJax speech for block labels and removes nested tab stops", async () => {
        const p = await makeParsons({
            blocks: '<span class="process-math">\(x^2\)</span>',
            attrs: 'data-language="natural"',
        });
        const block = p.blocks[0];
        const lines = block.view.querySelector(".lines");
        const math = document.createElement("mjx-container");

        lines.replaceChildren(math);
        math.tabIndex = 0;
        math.setAttribute("data-semantic-speech-none", "x squared");
        await tick();

        expect(block.view.getAttribute("role")).toBe("button");
        expect(block.view.getAttribute("aria-label")).toBe("x squared");
        expect(math.getAttribute("tabindex")).toBe("-1");
    });

    it("makes the sortable container the keyboard entry point", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });

        expect(p.sortContainerDiv.getAttribute("tabindex")).toBe("0");
        expect(p.sortContainerDiv.getAttribute("role")).toBe("button");
        expect(
            p.blocks.map((block) => block.view.getAttribute("tabindex")),
        ).toEqual(["-1", "-1", "-1"]);
    });
});

describe("option parsing", () => {
    it("defaults to python and its prettify class", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: 'data-order="0,1,2"',
        });
        expect(p.options.language).toBe("python");
        expect(p.options.prettifyLanguage).toBe("prettyprint lang-py");
        expect(p.lines[0].view.tagName).toBe("CODE");
        expect(p.lines[0].view.classList.contains("lang-py")).toBe(true);
    });

    it("maps other languages; unknown language gets no prettify class", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: 'data-language="java" data-order="0,1,2"',
        });
        expect(p.options.prettifyLanguage).toBe("prettyprint lang-java");

        const q = await makeParsons({
            id: "test_parsons_weird_lang",
            blocks: FLAT_BLOCKS,
            attrs: 'data-language="brainfudge" data-order="0,1,2"',
        });
        expect(q.options.prettifyLanguage).toBe("");
    });

    it("parses order, maxdist, noindent and numbered attributes", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: 'data-language="python" data-order="2,0,1" data-maxdist="1" data-noindent="true" data-numbered="left"',
        });
        expect(p.options.order).toEqual([2, 0, 1]);
        expect(p.options.maxdist).toBe(1);
        expect(p.noindent).toBe(true);
        expect(p.options.numbered).toBe("left");
        // Source blocks follow data-order.
        const texts = p.sourceBlocks().map((b) => b.lines[0].text);
        expect(texts).toEqual(["line_c = 3", "line_a = 1", "line_b = 2"]);
    });

    it("numbered problems label each block", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + ' data-numbered="left"',
        });
        const labels = p
            .sourceBlocks()
            .map((b) => b.view.querySelector(".block-label").textContent);
        expect(labels).toEqual(["1 ", "2 ", "3 "]);
    });

    it("parses data-explanations JSON and tolerates bad JSON", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + ' data-explanations=\'{"0": "first line"}\'',
        });
        expect(p.blockExplanations).toEqual({ 0: "first line" });

        const q = await makeParsons({
            id: "test_parsons_bad_json",
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + " data-explanations='{not json'",
        });
        expect(q.blockExplanations).toEqual({});
    });
});

describe("line initialization", () => {
    it("normalizes indents to levels and keeps line text", async () => {
        const p = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS,
        });
        expect(p.lines.map((l) => l.text)).toEqual([
            "def main():",
            'print("Hello")',
            'print("Bye")',
        ]);
        expect(p.lines.map((l) => l.indent)).toEqual([0, 1, 1]);
    });

    it("flags distractors and stores their help text", async () => {
        const p = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS,
        });
        expect(p.lines[2].distractor).toBe(true);
        expect(p.lines[2].paired).toBe(false);
        expect(p.lines[2].distractHelptext).toBe("not needed");
        // Distractors are not part of the solution.
        expect(p.solution).toEqual([p.lines[0], p.lines[1]]);
    });

    it("marks paired distractors", async () => {
        const p = await makeParsons({
            blocks: "a = 1\n---\na = 2 #paired: close but no",
            attrs: FLAT_ATTRS,
        });
        expect(p.lines[1].distractor).toBe(true);
        expect(p.lines[1].paired).toBe(true);
        expect(p.lines[1].distractHelptext).toBe("close but no");
    });

    it("groups multi-line segments into a single block", async () => {
        const p = await makeParsons({
            blocks: "a = 1\nb = 2\n---\nc = 3",
            attrs: FLAT_ATTRS,
        });
        expect(p.lines[0].groupWithNext).toBe(true);
        expect(p.lines[1].groupWithNext).toBe(false);
        expect(p.blocks).toHaveLength(2);
        expect(p.blocks[0].lines).toHaveLength(2);
    });
});

describe("hashing", () => {
    it("hashes empty areas as '-' and blocks as lineIndexes_indent", async () => {
        const p = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS,
        });
        expect(p.answerHash()).toBe("-");
        expect(p.sourceHash()).toBe("0_0-1_0-2_0");
        answer(p, [0, 1]);
        p.answerBlocks()[1].indent = 1;
        expect(p.answerHash()).toBe("0_0-1_1");
        expect(p.sourceHash()).toBe("2_0");
    });

    it("round-trips blocks through blocksFromHash", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS,
        });
        const blocks = p.blocksFromHash("0_1_0-2_0");
        expect(blocks).toHaveLength(2);
        expect(blocks[0].lines.map((l) => l.index)).toEqual([0, 1]);
        expect(blocks[0].hash()).toBe("0_1_0");
        expect(blocks[1].hash()).toBe("2_0");
    });

    it("decodes adaptive state hashes", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        expect(p.optionsFromHash("d2-i-c3-s")).toEqual({
            disabled: [2],
            noindent: true,
            checkCount: 3,
            hasSolved: true,
        });
        expect(p.optionsFromHash("-")).toEqual({});
    });

    it("encodes adaptive state for adaptive problems", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + ' data-adaptive="true"',
        });
        expect(p.adaptiveHash()).toBe("c0");
        expect(p.adaptiveHash()).not.toContain("s");
    });
});

describe("grading", () => {
    it("reports incorrectTooShort when blocks are missing", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        answer(p, [0]);
        p.checkCurrentAnswer();
        expect(p.grade).toBe("incorrectTooShort");
        expect(p.hasSolved).toBe(false);
        expect(p.checkCount).toBe(1);
    });

    it("reports incorrectMoveBlocks for wrong order", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        answer(p, [1, 0, 2]);
        p.checkCurrentAnswer();
        expect(p.grade).toBe("incorrectMoveBlocks");
        expect(p.percent).toBeCloseTo(0.2 + 0.4 / 3 + 0.4 / 3, 5);
    });

    it("linegrader reports correct LIS for incorrect order", async () => {
        const p = await makeParsons();
        // longest increasing subsequence has values 1, 2, 3, 4, excludes indexes 0 and 2
        const inverseLIS1 = p.grader.inverseLISIndices([5, 1, 6, 2, 3, 4]);
        expect(inverseLIS1).toEqual([0, 2]);
    });

    it("reports correct, locks the check button and records the solve", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        answer(p, [0, 1, 2]);
        p.checkCurrentAnswer();
        expect(p.grade).toBe("correct");
        expect(p.hasSolved).toBe(true);
        expect(p.correct).toBe(true);
        expect(p.percent).toBe(1);
        expect(p.checkButton.disabled).toBe(true);
        expect(localStorage.getItem(p.storageId + "Solved")).toBe("true");
    });

    it("reports incorrectIndent when order is right but indent wrong", async () => {
        const p = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS,
        });
        answer(p, [0, 1]); // print("Hello") left at indent 0
        p.checkCurrentAnswer();
        expect(p.grade).toBe("incorrectIndent");

        p.answerBlocks()[1].indent = 1;
        p.checkCurrentAnswer();
        expect(p.grade).toBe("correct");
    });

    it("counts distinct attempts, not repeats (adaptive only)", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + ' data-adaptive="true"',
        });
        answer(p, [1, 0, 2]);
        p.checkCurrentAnswer();
        p.checkCurrentAnswer();
        expect(p.numDistinct).toBe(1);
        expect(p.checkCount).toBe(2);
    });
});

describe("feedback rendering", () => {
    it("shows the success message and marks the answer area", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        answer(p, [0, 1, 2]);
        p.checkCurrentAnswer();
        p.renderFeedback();
        expect(p.answerArea.classList.contains("correct")).toBe(true);
        expect(p.messageDiv.style.visibility).toBe("visible");
        expect(p.messageDiv.getAttribute("class")).toBe("alert alert-info");
        await tick(30);
        expect(p.messageDiv.textContent).toContain("Perfect!");
    });

    it("highlights out-of-place blocks on wrong order", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        answer(p, [1, 0, 2]);
        p.checkCurrentAnswer();
        p.renderFeedback();
        expect(p.answerArea.classList.contains("incorrect")).toBe(true);
        expect(p.messageDiv.getAttribute("class")).toBe("alert alert-danger");
        const flagged = p
            .answerBlocks()
            .filter((b) => b.view.classList.contains("incorrectPosition"));
        expect(flagged.length).toBeGreaterThan(0);
        await tick(30);
        expect(p.messageDiv.textContent).toContain(
            "wrong or are in the wrong order",
        );
    });

    it("marks misindented blocks", async () => {
        const p = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS,
        });
        answer(p, [0, 1]);
        p.checkCurrentAnswer();
        p.renderFeedback();
        const hello = p.answerBlocks()[1];
        expect(hello.view.classList.contains("indentRight")).toBe(true);
        await tick(30);
        expect(p.messageDiv.textContent).toContain("not indented correctly");
    });

    it("clearFeedback removes classes and hides the message", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        answer(p, [1, 0, 2]);
        p.checkCurrentAnswer();
        p.renderFeedback();
        p.clearFeedback();
        expect(p.answerArea.classList.contains("incorrect")).toBe(false);
        expect(p.messageDiv.style.visibility).toBe("hidden");
        for (const b of p.answerBlocks()) {
            expect(b.view.classList.contains("incorrectPosition")).toBe(false);
        }
    });

    it("adds explanation tooltips to answer blocks after solving", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + ' data-explanations=\'{"0": "first!"}\'',
        });
        answer(p, [0, 1, 2]);
        p.checkCurrentAnswer();
        p.renderFeedback();
        const first = p.answerBlocks()[0];
        expect(first.view.getAttribute("title")).toBe("first!");
        expect(first.view.classList.contains("has-explanation")).toBe(true);
        p.clearFeedback();
        expect(first.view.getAttribute("title")).toBeNull();
        expect(first.view.classList.contains("has-explanation")).toBe(false);
    });
});

describe("reset", () => {
    it("returns all blocks to the source area and clears state", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        answer(p, [0, 1, 2]);
        p.checkCurrentAnswer();
        expect(p.checkButton.disabled).toBe(true);
        p.resetButton.click();
        await tick();
        expect(p.answerBlocks()).toHaveLength(0);
        expect(p.sourceBlocks()).toHaveLength(3);
        expect(p.checkCount).toBe(0);
        expect(p.hasSolved).toBe(false);
        expect(p.checkButton.disabled).toBe(false);
        expect(p.messageDiv.style.visibility).toBe("hidden");
    });
});

describe("persistence", () => {
    it("stores source/answer hashes in localStorage", async () => {
        const p = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS,
        });
        answer(p, [0, 1]);
        p.answerBlocks()[1].indent = 1;
        p.setLocalStorage();
        const stored = JSON.parse(localStorage.getItem(p.storageId));
        expect(stored.source).toBe("2_0");
        expect(stored.answer).toBe("0_0-1_1");
        expect(stored.timestamp).toBeTruthy();
    });

    it("restores a saved answer on construction and grades it", async () => {
        const p = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS,
        });
        answer(p, [0, 1]);
        p.answerBlocks()[1].indent = 1;
        p.setLocalStorage();

        const restored = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS,
        });
        expect(restored.answerBlocks()).toHaveLength(2);
        expect(restored.answerHash()).toBe("0_0-1_1");
        expect(restored.sourceHash()).toBe("2_0");
        expect(restored.correct).toBe(true);
    });
});

describe("keyboard movement model", () => {
    it("moveRight moves a source block into the answer area", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        const block = p.sourceBlocks()[0];
        block.moveRight();
        expect(block.inSourceArea()).toBe(false);
        expect(p.answerBlocks()).toContain(block);
    });

    it("moveRight in the answer area increases indent up to the limit", async () => {
        const p = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS,
        });
        expect(p.indent).toBe(1);
        const block = p.sourceBlocks()[1];
        block.moveRight(); // into answer, indent reset to 0
        expect(block.indent).toBe(0);
        block.moveRight();
        expect(block.indent).toBe(1);
        block.moveRight(); // at the limit, stays
        expect(block.indent).toBe(1);
    });

    it("moveLeft reduces indent then returns the block to the source", async () => {
        const p = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS,
        });
        const block = p.sourceBlocks()[1];
        block.moveRight();
        block.moveRight();
        block.moveLeft();
        expect(block.indent).toBe(0);
        expect(block.inSourceArea()).toBe(false);
        block.moveLeft();
        expect(block.inSourceArea()).toBe(true);
    });

    it("moveUp and moveDown reorder blocks in the answer area", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        answer(p, [0, 1, 2]);
        const [a, b, c] = p.answerBlocks();
        b.moveDown();
        expect(p.answerBlocks()).toEqual([a, c, b]);
        b.moveUp();
        expect(p.answerBlocks()).toEqual([a, b, c]);
        a.moveUp(); // already first: no-op
        expect(p.answerBlocks()).toEqual([a, b, c]);
    });

    it("Enter on the container begins keyboard mode; blur leaves it", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        const block = p.sourceBlocks()[0];

        p.sortContainerDiv.focus();
        p.sortContainerDiv.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "Enter",
            }),
        );

        expect(p.textFocus).toBe(block);
        expect(p.keyboardApplication.getAttribute("aria-label")).toBe(
            `Use arrow keys to navigate blocks, then Enter or Space to move it. Selected ${p.getBlockLabel(block)}. In the unplaced list, position 1 of 3.`,
        );
        expect(block.view.classList.contains("down")).toBe(true);
        expect(p.keyboardTip.textContent).toContain("Arrow keys to navigate");
        expect(p.keyboardTip.style.display).not.toBe("none");
        expect(p.sourceLabel.style.display).toBe("none");
        p.keyboardApplication.blur();
        expect(p.textFocus).toBeUndefined();
        expect(p.keyboardTip.style.display).toBe("none");
        expect(p.sourceLabel.style.display).not.toBe("none");
    });

    it("space toggles a selected block between select and move", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        p.startKeyboardInteraction();
        const block = p.textFocus;

        p.handleKeyboardMovementKeydown({
            key: " ",
            preventDefault() {},
        });
        expect(p.textMove).toBe(true);
        expect(block.view.classList.contains("up")).toBe(true);
        p.handleKeyboardMovementKeydown({
            key: " ",
            preventDefault() {},
        });
        expect(p.textMove).toBe(false);
        expect(block.view.classList.contains("down")).toBe(true);
    });

    it("returns focus to the entry button when Escape leaves keyboard navigation", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });

        p.startKeyboardInteraction();
        p.keyboardApplication.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "Escape",
            }),
        );

        expect(p.textFocus).toBeUndefined();
        expect(document.activeElement).toBe(p.sortContainerDiv);
    });

    it("lets Tab leave native keyboard navigation", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS,
        });
        p.startKeyboardInteraction();
        const tabEvent = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Tab",
        });
        p.keyboardApplication.dispatchEvent(tabEvent);

        expect(tabEvent.defaultPrevented).toBe(false);
        expect(p.textFocus).toBeUndefined();
        expect(p.sortContainerDiv.getAttribute("tabindex")).toBe("0");
        expect(
            p.blocks.map((block) => block.view.getAttribute("tabindex")),
        ).toEqual(["-1", "-1", "-1"]);
    });

    it("uses the application container to navigate yellow selections", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        const [first, second] = p.sourceBlocks();

        p.startKeyboardInteraction();
        p.keyboardApplication.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "ArrowDown",
            }),
        );

        expect(p.textFocus).toBe(second);
        expect(p.keyboardApplication.getAttribute("aria-label")).toBe(
            `Selected ${p.getBlockLabel(second)}. In the unplaced list, position 2 of 3.`,
        );
        expect(document.activeElement).toBe(p.keyboardApplication);
        expect(first.view.classList.contains("down")).toBe(false);
        expect(second.view.classList.contains("down")).toBe(true);
    });

    it("retains and announces incorrect feedback until a keyboard move", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        answer(p, [1, 0, 2]);
        p.checkCurrentAnswer();
        p.renderFeedback();

        const incorrect = p
            .answerBlocks()
            .find((block) => p.isIncorrectBlock(block));
        expect(incorrect).toBeDefined();
        expect(incorrect.view.getAttribute("aria-label")).toBe(
            `${p.getBlockLabel(incorrect)}. Incorrect`,
        );

        p.startKeyboardInteraction();

        expect(p.textFocus).toBe(incorrect);
        expect(incorrect.view.classList.contains("incorrectPosition")).toBe(
            true,
        );
        expect(p.keyboardApplication.getAttribute("aria-label")).toBe(
            `Use arrow keys to navigate blocks, then Enter or Space to move it. Selected ${p.getBlockLabel(incorrect)}. Incorrect. ${p.getKeyboardBlockLocation(incorrect)}`,
        );

        const movable = p.answerBlocks()[0];
        p.selectKeyboardBlock(movable);
        p.handleKeyboardMovementKeydown({
            key: " ",
            preventDefault() {},
        });
        p.handleKeyboardMovementKeydown({
            key: "ArrowDown",
            preventDefault() {},
        });

        expect(p.answerBlocks()[1]).toBe(movable);
        expect(incorrect.view.classList.contains("incorrectPosition")).toBe(
            false,
        );
        expect(incorrect.view.getAttribute("aria-label")).toBe(
            p.getBlockLabel(incorrect),
        );
    });

    it("localizes keyboard announcements", async () => {
        setLocale("pt-br");
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });

        p.startKeyboardInteraction();

        expect(p.sortContainerDiv.getAttribute("aria-label")).toBe(
            "Problema Parsons. Pressione Enter ou Espaço para organizar os blocos.",
        );
        expect(p.keyboardApplication.getAttribute("aria-label")).toBe(
            "Use as teclas de seta para navegar pelos blocos e pressione Enter ou Espaço para movê-los. Selecionado line_a = 1. Na lista não posicionada, posição 1 de 3.",
        );
    });

    it("uses the application proxy only during keyboard interaction", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });

        p.startKeyboardInteraction();

        expect(p.sortContainerDiv.getAttribute("role")).toBe("button");
        expect(p.keyboardApplication.getAttribute("role")).toBe("application");
        expect(document.activeElement).toBe(p.keyboardApplication);

        p.cancelKeyboardMovement();

        expect(p.sortContainerDiv.getAttribute("role")).toBe("button");
    });

    it("announces a block's current position, indentation, and alternate group", async () => {
        const p = await makeParsons({
            blocks: `root
---
    choice_a
---
    choice_b #paired
---
    finish`,
            attrs: 'data-language="python" data-order="0,1,2,3"',
        });
        const first = p.sourceBlocks()[0];
        const alternate = p.sourceBlocks()[1];

        expect(p.getKeyboardBlockLocation(first)).toBe(
            "In the unplaced list, position 1 of 4.",
        );
        expect(p.getKeyboardBlockLocation(alternate)).toBe(
            "In the unplaced list, position 2 of 4. 1 of 2 options.",
        );

        alternate.moveRight();
        alternate.indent = 1;

        expect(p.getKeyboardBlockLocation(alternate)).toBe(
            "In the answer area, position 1 of 1. 1 tab in. 1 of 2 options.",
        );
    });

    it("uses a click to pick up a block", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        const block = p.sourceBlocks()[0];
        p.startKeyboardInteraction();
        block.view.dispatchEvent(
            new MouseEvent("click", { bubbles: true, detail: 1 }),
        );

        expect(p.textFocus).toBe(block);
        expect(p.textMove).toBe(true);
        expect(document.activeElement).toBe(p.keyboardApplication);
    });

    it("ignores a click before a block enters keyboard mode", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        const block = p.sourceBlocks()[0];

        block.view.dispatchEvent(
            new MouseEvent("click", { bubbles: true, detail: 0 }),
        );

        expect(p.textFocus).toBeUndefined();
        expect(p.textMove).toBeUndefined();
        expect(block.view.classList.contains("up")).toBe(false);
    });

    it("moves a picked-up block from the component's keydown capture", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        const block = p.sourceBlocks()[0];

        p.startKeyboardInteraction();
        p.keyboardApplication.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: " ",
            }),
        );
        const moveEvent = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "ArrowRight",
        });
        block.view.dispatchEvent(moveEvent);

        expect(moveEvent.defaultPrevented).toBe(true);
        expect(block.inSourceArea()).toBe(false);
        expect(p.keyboardApplication.getAttribute("aria-label")).toBe(
            "In the answer area, position 1 of 1.",
        );
        expect(document.activeElement).toBe(p.keyboardApplication);

        const dropEvent = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Enter",
        });
        p.keyboardApplication.dispatchEvent(dropEvent);

        expect(dropEvent.defaultPrevented).toBe(true);
        expect(p.textMove).toBe(false);
        expect(document.activeElement).toBe(p.keyboardApplication);
    });

    it("cleans up the first block before moving a second block", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        const [first, second] = p.sourceBlocks();

        p.startKeyboardInteraction();
        p.keyboardApplication.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: " ",
            }),
        );
        p.keyboardApplication.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "Enter",
            }),
        );

        p.keyboardApplication.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "ArrowDown",
            }),
        );
        expect(p.textFocus).toBe(second);
        p.keyboardApplication.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: " ",
            }),
        );
        second.view.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "ArrowRight",
            }),
        );

        expect([...p.outerDiv.querySelectorAll(".block.up")]).toEqual([
            second.view,
        ]);
        expect(p.outerDiv.querySelectorAll(".block.down")).toHaveLength(0);

        p.keyboardApplication.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                key: "Enter",
            }),
        );

        expect(p.outerDiv.querySelectorAll(".block.up")).toHaveLength(0);
        expect([...p.outerDiv.querySelectorAll(".block.down")]).toEqual([
            second.view,
        ]);
    });

    it("keeps initially disabled blocks out of keyboard rotation", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        const disabled = p.sourceBlocks()[0];
        const enabled = p.sourceBlocks()[1];

        disabled.view.classList.add("disabled");
        p.initializeTabIndex();

        expect(disabled.enabled()).toBe(false);
        expect(disabled.view.hasAttribute("tabindex")).toBe(false);
        expect(p.enabledSourceBlocks()).not.toContain(disabled);

        p.startKeyboardInteraction();
        expect(p.textFocus).toBe(enabled);
    });

    it("disable() removes a block from keyboard rotation", async () => {
        const p = await makeParsons({ blocks: FLAT_BLOCKS, attrs: FLAT_ATTRS });
        const block = p.sourceBlocks()[0];
        block.disable();
        expect(block.enabled()).toBe(false);
        expect(p.sortContainerDiv.getAttribute("tabindex")).toBe("0");
        expect(block.view.hasAttribute("tabindex")).toBe(false);
        expect(
            p.blocks.slice(1).map((item) => item.view.getAttribute("tabindex")),
        ).toEqual(["-1", "-1"]);
    });
});

describe("adaptive problems", () => {
    it("initializes adaptive bookkeeping in localStorage", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + ' data-adaptive="true"',
        });
        expect(p.canHelp).toBe(true);
        expect(localStorage.getItem(p.adaptiveId + "Problem")).toBe(p.divid);
        expect(localStorage.getItem(p.adaptiveId + "recentAttempts")).toBe("3");
        expect(localStorage.getItem(p.adaptiveId + "Solved")).toBe("false");
    });

    it("reports help eligibility through the live message instead of an alert", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + ' data-adaptive="true"',
        });
        p.helpMe();

        await tick(30);
        expect(p.messageDiv.getAttribute("role")).toBe("status");
        expect(p.messageDiv.style.visibility).toBe("visible");
        expect(p.messageDiv.textContent).toContain(
            "three distinct full attempts",
        );
        expect(p.gotHelp).toBe(false);
    });

    it("refreshes repeated Help Me announcements", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + ' data-adaptive="true"',
        });
        p.helpMe();
        await tick(30);

        p.helpMe();
        expect(p.messageDiv.textContent).toBe("");

        await tick(30);
        expect(p.messageDiv.textContent).toContain(
            "three distinct full attempts",
        );
    });

    it("includes Help Me availability in the next feedback message", async () => {
        const p = await makeParsons({
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS + ' data-adaptive="true"',
        });
        p.numDistinct = 2;
        p.lastAnswerHash = "different";
        answer(p, [1, 0, 2]);

        p.checkCurrentAnswer();
        p.renderFeedback();

        await tick(30);
        expect(p.messageDiv.textContent).toContain(
            "Click on the Help Me button",
        );
    });

    it("removeDistractor disables the block and reveals its help text", async () => {
        const p = await makeParsons({
            blocks: INDENTED_BLOCKS,
            attrs: INDENTED_ATTRS + ' data-adaptive="true"',
        });
        const distractor = p.sourceBlocks().find((b) => b.isDistractor());
        p.removeDistractor(distractor);
        expect(distractor.enabled()).toBe(false);
        expect(distractor.view.getAttribute("title")).toBe("not needed");
        await tick(30);
        expect(p.messageDiv.textContent).toContain(
            "Disabled an unneeded code block",
        );
    });
});

describe("paired distractor presentation", () => {
    it("builds paired bins and an 'or' bracket div", async () => {
        const p = await makeParsons({
            blocks: "a = 1\n---\na = 2 #paired\n---\nb = 3",
            attrs: FLAT_ATTRS,
        });
        expect(p.pairedBins).toEqual([[0, 1]]);
        expect(p.pairedDivs).toHaveLength(1);
        expect(p.sourceArea.querySelector(".paired")).toBe(p.pairedDivs[0]);
        // Both paired lines land in the same bin, so their blocks report it.
        const blocks = p.sourceBlocks();
        const bins = blocks.map((b) => b.pairedBin());
        expect(bins.filter((b) => b === 0)).toHaveLength(2);
        expect(bins.filter((b) => b === -1)).toHaveLength(1);
    });
});

describe("scaffolding (CodeTailor) problems", () => {
    it("pre-places settled blocks and placeholders in the answer area", async () => {
        const p = await makeParsons({
            blocks: 'def main(): #settled\n---\n    print("Hello")\n---\n    print("Bye")',
            attrs: 'data-language="python" data-order="0,1" data-scaffolding="true"',
        });
        const answerBlocks = p.answerBlocks();
        expect(answerBlocks.some((b) => b.isSettled)).toBe(true);
        expect(answerBlocks.some((b) => b.isPlaceholder)).toBe(true);
        const placeholder = answerBlocks.find((b) => b.isPlaceholder);
        // (the count message is set via innerText, which jsdom doesn't render,
        // so assert the message container rather than its text)
        expect(placeholder.placeholderSize).toBe(2);
        expect(
            placeholder.view.querySelector(".placeholder-text"),
        ).toBeTruthy();
        expect(placeholder.view.classList.contains("placeholder-block")).toBe(
            true,
        );
        const settled = answerBlocks.find((b) => b.isSettled);
        expect(settled.view.classList.contains("settled-block")).toBe(true);
        expect(settled.view.classList.contains("disabled")).toBe(true);
        expect(
            settled.view.querySelector(".settled-tooltip").textContent,
        ).toContain("2 block");
        // Settled/placeholder lines stay out of the draggable source blocks.
        expect(p.sourceBlocks()).toHaveLength(2);
    });
});

describe("dag grading", () => {
    it("accepts any topological order of the dependency graph", async () => {
        const p = await makeParsons({
            blocks: "a = 1 #tag:1;depends:;\n---\nb = 2 #tag:2;depends:;\n---\nc = a + b #tag:3;depends:1,2;",
            attrs: 'data-language="python" data-order="0,1,2" data-grader="dag"',
        });
        expect(p.lines[0].tag).toBe("1");
        expect(p.lines[2].depends).toEqual(["1", "2"]);
        answer(p, [1, 0, 2]); // b before a: still a valid topological order
        p.checkCurrentAnswer();
        expect(p.grade).toBe("correct");
    });
});

describe("timed parsons", () => {
    it("component factory returns a feedback-suppressed timed variant", async () => {
        const orig = makeFixture({
            id: "test_parsons_timed",
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS,
        });
        const p = window.component_factory["parsons"]({
            orig: orig,
            timed: true,
            useRunestoneServices: false,
        });
        await p.component_ready_promise;
        await tick();
        expect(p.showfeedback).toBe(false);
        expect(p.checkButton.style.display).toBe("none");
        expect(p.resetButton.style.display).toBe("none");
        expect(p.messageDiv.style.display).toBe("none");
        answer(p, [0, 1, 2]);
        p.checkCurrentAnswer();
        expect(p.checkCorrectTimed()).toBe("T");
    });
});

describe("page integration", () => {
    it("renders every [data-component=parsons] on login-complete", async () => {
        makeFixture({
            id: "test_parsons_page",
            blocks: FLAT_BLOCKS,
            attrs: FLAT_ATTRS,
        });
        document.dispatchEvent(new Event("runestone:login-complete"));
        const p = window.componentMap["test_parsons_page"];
        expect(p).toBeInstanceOf(Parsons);
        await p.component_ready_promise;
    });
});
