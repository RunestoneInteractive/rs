import RunestoneBase from "../../common/js/runestonebase.js";
import "../css/hljs-xcode.css";
import BlockFeedback from "./BlockFeedback.js";
import SQLFeedback from "./SQLFeedback.js";
import { InitMicroParsons } from "micro-parsons/micro-parsons/micro-parsons.js";
import "micro-parsons/micro-parsons/micro-parsons.css";
// If you need to debug something in the micro-parsons library then
// gh repo clone amy21206/micro-parsons-element
// run npm install and npm build
// copy everything from bin into the hparsons/js folder and build the components.
/*import {InitMicroParsons} from './micro-parsons.js';
import './micro-parsons.css';*/
// last to override micro-parsons css if needed
import "../css/hparsons.css";

export var hpList;
// Dictionary that contains all instances of horizontal Parsons problem objects
if (hpList === undefined) hpList = {};

export default class HParsons extends RunestoneBase {
    constructor(opts) {
        super(opts);
        // getting settings
        var orig = opts.orig.querySelector("textarea");
        this.reuse = this.parseBooleanAttribute(orig, "data-reuse");
        this.randomize = this.parseBooleanAttribute(orig, "data-randomize");
        this.isBlockGrading = this.parseBooleanAttribute(orig, "data-blockanswer");
        this.language = orig.getAttribute("data-language");
        // Detect math mode
        if ((this.language == null) && orig.textContent.includes('span class="process-math"')) {
            this.language = "math";
        }
        if (this.isBlockGrading) {
            this.blockAnswer = orig.getAttribute("data-blockanswer").split(" ");
        }
        this.divid = opts.orig.id;
        this.containerDiv = opts.orig;
        this.useRunestoneServices = opts.useRunestoneServices;

        // Set the storageId (key for storing data)
        var storageId = super.localStorageKey();
        this.storageId = storageId;

        this.origElem = orig;
        let statementElem = opts.orig.querySelector(".hp_question");
        if (statementElem) statementElem.classList.add("exercise-statement");
        this.origText = this.origElem.textContent;
        this.code = orig.textContent || "\n\n\n\n\n";
        this.dburl = orig.getAttribute("data-dburl");
        this.runButton = null;
        this.saveButton = null;
        this.loadButton = null;
        this.outerDiv = null;
        this.controlDiv = null;
        this.processContent(this.code);

        // Change to factory when more execution based feedback is included
        if (this.isBlockGrading) {
            this.feedbackController = new BlockFeedback(this);
        } else {
            this.feedbackController = new SQLFeedback(this);
        }

        // creating UI components
        this.createEditor();
        this.createControls();
        this.createOutput();
        this.feedbackController.customizeUI();

        if (orig.getAttribute("data-caption")) {
            this.caption = orig.getAttribute("data-caption");
        } else {
            this.caption = "MicroParsons";
        }
        this.addCaption("runestone");
        this.indicate_component_ready();

        // initializing functionalities for different feedback
        this.feedbackController.init();
        this.checkServer("hparsonsAnswer", true);
    }

    processContent(code) {
        // todo: add errors when blocks are nonexistent (maybe in python)?
        this.hiddenPrefix = this.processSingleContent(code, "--hiddenprefix--");
        this.originalBlocks = this.processSingleContent(code, "--blocks--")
            .split("\n")
            .slice(1, -1);
        this.hiddenSuffix = this.processSingleContent(code, "--hiddensuffix--");
        this.unittest = this.processSingleContent(code, "--unittest--");
    }

    processSingleContent(code, delimiter) {
        let index = code.indexOf(delimiter);
        if (index > -1) {
            let content = code.substring(index + delimiter.length);
            let endIndex = content.indexOf("\n--");
            content =
                endIndex > -1 ? content.substring(0, endIndex + 1) : content;
            return content;
        }
        return undefined;
    }

    // copied from activecode, already modified to add parsons
    createEditor() {
        this.outerDiv = document.createElement("div");
        this.origElem.replaceWith(this.outerDiv);
        this.outerDiv.id = `${this.divid}-container`;
        this.outerDiv.addEventListener("micro-parsons", (ev) => {
            const eventListRunestone = ["input", "reset"];
            if (eventListRunestone.includes(ev.detail.type)) {
                // only log the events in the event list
                this.logHorizontalParsonsEvent(ev.detail);
                // when event is input or reset: clear previous feedback
                this.feedbackController.clearFeedback();
            }
        });
        const props = {
            selector: `#${this.divid}-container`,
            id: `${this.divid}-hparsons`,
            reuse: this.reuse,
            randomize: this.randomize,
            parsonsBlocks: [...this.originalBlocks],
            language: this.language,
        };
        InitMicroParsons(props);
        this.hparsonsInput = this.outerDiv.querySelector("micro-parsons");
        this.renderMathInBlocks();
        // Change "code" to "answer" in parsons direction for non-code languages
        if (this.language == null || this.language === "math") {
            this.outerDiv.querySelectorAll(".hparsons-tip").forEach(el => {
                if (el.textContent.includes("our code")) {
                    el.textContent = el.textContent.replace("our code", "our answer");
                }
            });
        }
    }

    createOutput() {
        this.feedbackController.createOutput();
    }

    createControls() {
        var ctrlDiv = document.createElement("div");
        ctrlDiv.classList.add("hp_actions");

        // Run Button
        this.runButton = document.createElement("button");
        this.runButton.classList.add("btn", "btn-success", "run-button");
        ctrlDiv.appendChild(this.runButton);
        this.runButton.setAttribute("type", "button");
        this.runButton.textContent = "Run";
        var that = this;
        this.runButton.onclick = () => {
            that.feedbackController.runButtonHandler();
            that.setLocalStorage();
        };

        // Reset button
        var resetBtn;
        resetBtn = document.createElement("button");
        resetBtn.textContent = "Reset";
        resetBtn.classList.add("btn", "btn-warning", "run-button");
        ctrlDiv.appendChild(resetBtn);
        this.resetButton = resetBtn;
        this.resetButton.onclick = () => {
            that.hparsonsInput.resetInput();
            that.setLocalStorage();
            that.feedbackController.reset();
            that.renderMathInBlocks();
        };
        resetBtn.setAttribute("type", "button");

        this.outerDiv.appendChild(ctrlDiv);
        this.controlDiv = ctrlDiv;
    }

    // Decodes escaped HTML entities (like &lt;) into raw characters
    decodeHTMLEntities(str) {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = str;
        return textarea.value;
    }

    renderMathInBlocks() {
        if (this.language !== "math") return;
        setTimeout(() => {
            const blocks = document.querySelectorAll(`#${this.divid}-container .parsons-block`);
            blocks.forEach(block => {
                block.innerHTML = this.decodeHTMLEntities(block.innerHTML);
            });

            if (window.MathJax && MathJax.typesetPromise) {
                MathJax.typesetPromise();
            }
        }, 0);
    }

    // Return previous answers in local storage
    //
    localData() {
        var data = localStorage.getItem(this.storageId);
        if (data !== null) {
            if (data.charAt(0) == "{") {
                data = JSON.parse(data);
            } else {
                data = {};
            }
        } else {
            data = {};
        }
        return data;
    }
    // RunestoneBase: Sent when the server has data
    restoreAnswers(serverData) {
        // TODO: not tested with server data yet.
        // Server side data should be:
        /*
            {
                answer: Array<string>, // list of answer block content
                count: ?number // number of previous attempts if block-based feedback
            }
        */
        if (serverData.answer) {
            const blocks = serverData.answer.blocks ?? serverData.answer;

            if (Array.isArray(blocks) && blocks.length > 0) {
                const first = blocks[0];

                // Prefer indices (numbers or numeric strings)
                const looksNumeric = (typeof first === "number") || (/^\d+$/.test(String(first)));
                if (looksNumeric && this.hparsonsInput.restoreAnswerByIndices) {
                    this.hparsonsInput.restoreAnswerByIndices(blocks.map(Number));
                } else {
                    this.hparsonsInput.restoreAnswer(blocks);
                }
            }
        }
        if (serverData.count) {
            this.feedbackController.checkCount = serverData.count;
        }
    }

































    // RunestoneBase: Load what is in local storage
    checkLocalStorage() {
        if (this.graderactive) {
            // Zihan: I think this means the component is still loading?
            return;
        }
        let localData = this.localData();
        if (localData.answerIndices && this.hparsonsInput.restoreAnswerByIndices) {
            this.hparsonsInput.restoreAnswerByIndices(localData.answerIndices.map(Number));
        } else if (localData.answer) {
            // Legacy restore (string-based)
            this.hparsonsInput.restoreAnswer(localData.answer);

            // Best-effort migration: persist indices after restoring
            if (this.isBlockGrading) {
                const migrated = this.hparsonsInput.getBlockIndices();
                localData.answerIndices = migrated;
                localStorage.setItem(this.storageId, JSON.stringify(localData));
            }
        }
        if (localData.count) {
            this.feedbackController.checkCount = localData.count;
        }
    }
    // RunestoneBase: Set the state of the problem in local storage
    setLocalStorage(data) {
        let currentState = {};
        if (data == undefined) {

            if (this.isBlockGrading) {
                const answerIndices = this.hparsonsInput.getBlockIndices();
                currentState = { answerIndices: answerIndices };
                currentState.count = this.feedbackController.checkCount;
            } else {
                const userAnswer = this.hparsonsInput.getParsonsTextArray();
                currentState = { answer: userAnswer };
            }

        } else {
            currentState = data;
        }
        localStorage.setItem(this.storageId, JSON.stringify(currentState));
    }

    logHorizontalParsonsEvent(hparsonsEvent) {
        let ev = {
            event: "hparsons",
            div_id: this.divid,
            act: JSON.stringify(hparsonsEvent),
        };
        this.logBookEvent(ev);
    }
}

/*=================================
== Find the custom HTML tags and ==
==   execute our code on them    ==
=================================*/
document.addEventListener("runestone:login-complete", function () {
    document.querySelectorAll("[data-component=hparsons]").forEach(function (el) {
        if (!el.closest("[data-component=timedAssessment]")) {
            // If this element exists within a timed component, don't render it here
            // try {
            hpList[el.id] = new HParsons({
                orig: el,
                useRunestoneServices: eBookConfig.useRunestoneServices,
            });
            // } catch (err) {
            //     console.log(`Error rendering ShortAnswer Problem ${this.id}
            //     Details: ${err}`);
            // }
        }
    });
});

if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}
window.component_factory["hparsons"] = function (opts) {
    return new HParsons(opts);
};
