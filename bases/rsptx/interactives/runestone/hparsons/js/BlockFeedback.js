import HParsonsFeedback from "./hparsonsFeedback";
import { t } from "../../common/js/rsi18n.js";
import BlockBasedGrader from "./blockGrader.js";
import "../../parsons/js/parsons-i18n.en.js";
import "../../parsons/js/parsons-i18n.pt-br.js";
import "../../parsons/js/parsons-i18n.sr-Cyrl.js";

export default class BlockFeedback extends HParsonsFeedback {
    createOutput() {
        // Block based grading output
        this.messageDiv = document.createElement("div");
        this.hparsons.outerDiv.appendChild(this.messageDiv);
    }

    customizeUI() {
        this.hparsons.runButton.textContent = "Check Me";
    }

    init() {
        this.checkCount = 0;
        this.solved = false;
        // TODO: not sure what is the best way to do this
        this.grader = new BlockBasedGrader();
        // Grade on block *content*, not on block index. Two blocks holding the
        // same text are interchangeable, so a solution that uses the same text
        // twice (issue #1194: a query with two "=" blocks) must accept either
        // one in either position. Content is read from the authored source
        // blocks rather than from the DOM so that math blocks -- whose rendered
        // text MathJax rewrites -- still compare correctly.
        this.solution = this.hparsons.blockAnswer.map((index) =>
            this.blockContent(index),
        );
        this.grader.solution = this.solution;
        this.answerArea =
            this.hparsons.hparsonsInput.querySelector(".drop-area");
    }

    // The authored source text for a block index. An index with no source block
    // gets a sentinel that can never match a solution block.
    blockContent(index) {
        const blocks = this.hparsons.originalBlocks || [];
        const content = blocks[Number(index)];
        return content === undefined ? `\u0000unknown-block-${index}` : content;
    }

    // The contents of the blocks currently in the answer area, in order.
    currentAnswerContent() {
        return this.hparsons.hparsonsInput
            .getBlockIndices()
            .map((index) => this.blockContent(index));
    }

    // Called when check button clicked (block-based Feedback)
    async runButtonHandler() {
        this.checkCurrentAnswer();
        this.logCurrentAnswer();
        this.renderFeedback();
    }

    async logCurrentAnswer() {
        let act = {
            scheme: "block",
            correct: this.grader.graderState == "correct" ? "T" : "F",
            answer: this.hparsons.hparsonsInput.getBlockIndices(),
            percent: this.grader.percent,
        };
        let logData = {
            event: "hparsonsAnswer",
            div_id: this.hparsons.divid,
            act: JSON.stringify(act),
            answer: JSON.stringify({ blocks: act.answer }),
            percent: this.grader.percent,
            correct: act.correct,
        };
        await this.hparsons.logBookEvent(logData);
    }

    // Used for block-based feedback
    checkCurrentAnswer() {
        if (!this.solved) {
            this.checkCount++;
            this.clearFeedback();
            this.grader.answer = this.currentAnswerContent();
            this.grade = this.grader.grade();
            if (this.grade == "correct") {
                this.hparsons.runButton.disabled = true;
                this.solved = true;
            }
        }
    }

    renderFeedback() {
        this.grade = this.grader.graderState;
        var feedbackArea;
        var answerArea = this.answerArea;
        feedbackArea = this.messageDiv;

        if (this.grade === "correct") {
            answerArea.classList.add("correct");
            feedbackArea.style.display = "";
            feedbackArea.className = "hp_feedback alert alert-info";
            if (this.checkCount > 1) {
                feedbackArea.innerHTML = t(
                    "msg_parson_correct",
                    this.checkCount,
                );
            } else {
                feedbackArea.innerHTML = t("msg_parson_correct_first_try");
            }
            this.checkCount = 0;
        }

        if (this.grade === "incorrectTooShort") {
            // too little code
            answerArea.classList.add("incorrect");
            feedbackArea.style.display = "";
            feedbackArea.className = "hp_feedback alert alert-danger";
            feedbackArea.innerHTML = t("msg_parson_too_short");
        }

        if (this.grade === "incorrectMoveBlocks") {
            var answerBlocks = this.answerArea.children;
            var inSolution = [];
            var inSolutionIndexes = [];
            var notInSolution = [];
            // Match each answer block to a solution position by content, not by
            // block index, so interchangeable blocks are not flagged. Each
            // solution position is claimed at most once, leftmost first, so
            // repeated content lines up in order.
            var claimed = new Set();
            for (let i = 0; i < answerBlocks.length; i++) {
                var block = answerBlocks[i];
                var content = this.blockContent(block.dataset.index);
                var index = -1;
                for (let j = 0; j < this.solution.length; j++) {
                    if (!claimed.has(j) && this.solution[j] === content) {
                        index = j;
                        claimed.add(j);
                        break;
                    }
                }
                if (index == -1) {
                    notInSolution.push(block);
                } else {
                    inSolution.push(block);
                    inSolutionIndexes.push(index);
                }
            }
            var lisIndexes = this.grader.inverseLISIndices(inSolutionIndexes);
            for (let i = 0; i < lisIndexes.length; i++) {
                notInSolution.push(inSolution[lisIndexes[i]]);
            }
            answerArea.classList.add("incorrect");
            feedbackArea.style.display = "";
            feedbackArea.className = "alert alert-danger";
            for (let i = 0; i < notInSolution.length; i++) {
                notInSolution[i].classList.add("incorrectPosition");
            }
            feedbackArea.innerHTML = t("msg_parson_wrong_order");
        }
    }

    // Feedback UI for Block-based Feedback
    clearFeedback() {
        this.answerArea.classList.remove("incorrect", "correct");
        var children = this.answerArea.childNodes;
        for (var i = 0; i < children.length; i++) {
            children[i].classList.remove(
                "correctPosition",
                "incorrectPosition",
            );
        }
        this.messageDiv.style.display = "none";
    }

    reset() {
        if (this.solved) {
            this.checkCount = 0;
            this.hparsons.runButton.disabled = false;
            this.solved = false;
        }
        this.clearFeedback();
    }
}
