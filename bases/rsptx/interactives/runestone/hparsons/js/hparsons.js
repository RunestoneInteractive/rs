import RunestoneBase from "../../common/js/runestonebase.js";
import "../css/hparsons.css";
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

export var hpList;
// Dictionary that contains all instances of horizontal Parsons problem objects
if (hpList === undefined) hpList = {};

export default class HParsons extends RunestoneBase {
    constructor(opts) {
        super(opts);
        // getting settings
        var orig = $(opts.orig).find("textarea")[0];
        this.reuse = $(orig).data("reuse") ? true : false;
        this.randomize = $(orig).data("randomize") ? true : false;
        this.isBlockGrading = $(orig).data("blockanswer") ? true : false;
        this.language = $(orig).data("language");
        // Detect math mode
        if (this.language === undefined && orig.textContent.includes('span class="process-math"')) {
            this.language = "math";
        }
        if (this.isBlockGrading) {
            this.blockAnswer = $(orig).data("blockanswer").split(" ");
        }
        this.divid = opts.orig.id;
        this.containerDiv = opts.orig;
        this.useRunestoneServices = opts.useRunestoneServices;

        // Set the storageId (key for storing data)
        var storageId = super.localStorageKey();
        this.storageId = storageId;

        this.origElem = orig;
        this.origText = this.origElem.textContent;
        this.code = $(orig).text() || "\n\n\n\n\n";
        this.dburl = $(orig).data("dburl");
        this.runButton = null;
        this.saveButton = null;
        this.loadButton = null;
        this.outerDiv = null;
        this.controlDiv = null;
        this.processContent(this.code);

        this.microParsonToRaw = new Map();
        this.simulatedSolution = [];

        // Change to factory when more execution based feedback is included
        if (this.isBlockGrading) {
            this.feedbackController = new BlockFeedback(this);
        } else {
            this.feedbackController = new SQLFeedback(this);
        }

        // creating UI components
        this.createEditor();
        this.createOutput();
        this.createControls();
        this.feedbackController.customizeUI();

        if ($(orig).data("caption")) {
            this.caption = $(orig).data("caption");
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
        $(this.origElem).replaceWith(this.outerDiv);
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
        this.hparsonsInput = $(this.outerDiv).find("micro-parsons")[0];
        this.renderMathInBlocks();
        // Change "code" to "answer" in parsons direction for non-code languages
        if (this.language === undefined || this.language === "math") {
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
        $(ctrlDiv).addClass("hp_actions");

        // Run Button
        this.runButton = document.createElement("button");
        $(this.runButton).addClass("btn btn-success run-button");
        ctrlDiv.appendChild(this.runButton);
        $(this.runButton).attr("type", "button");
        $(this.runButton).text("Run");
        var that = this;
        this.runButton.onclick = () => {
            that.feedbackController.runButtonHandler();
            that.setLocalStorage();
        };

        // Reset button
        var resetBtn;
        resetBtn = document.createElement("button");
        $(resetBtn).text("Reset");
        $(resetBtn).addClass("btn btn-warning run-button");
        ctrlDiv.appendChild(resetBtn);
        this.resetButton = resetBtn;
        this.resetButton.onclick = () => {
            that.hparsonsInput.resetInput();
            that.setLocalStorage();
            that.feedbackController.reset();
            that.renderMathInBlocks();
        };
        $(resetBtn).attr("type", "button");

        $(this.outerDiv).prepend(ctrlDiv);
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
                MathJax.typesetPromise().then(() => this.simulateSolution());
            }
        }, 0);
    }

    /*
        This function performs a simulated "correct answer" ordering using the
        correct block indices specified in `this.blockAnswer`. It looks ahead 
        at the rendered content from the MicroParsons widget to build:
        - this.simulatedSolution: an array of correctly ordered rendered strings
        - this.microParsonToRaw: a Map that links rendered HTML (from MicroParsons) 
          to their original raw `<m>` source strings from PreTeXt

        This is called after MathJax renders the math blocks to ensure the mapping
        is built from the final, visible DOM state. It is needed for grading 
        math-mode Parsons problems, where rendered symbols (e.g., “\(\alpha\)”) must
        be matched against author-defined symbolic content.
    */
    simulateSolution() {
        if (
            this.simulatedSolution.length > 0 &&
            this.microParsonToRaw instanceof Map &&
            this.microParsonToRaw.size > 0
        ) { // Already initialized from local storage
            this.feedbackController.solution = this.simulatedSolution;
            this.feedbackController.grader.solution = this.simulatedSolution;
            return; 
        }

        this.microParsonToRaw = new Map();

        const allBlocks = Array.from(
            this.outerDiv.querySelectorAll("micro-parsons .parsons-block")
        );
        if (!this.blockAnswer || allBlocks.length === 0) return;

        const rendered = this.hparsonsInput.getParsonsTextArray();
        const raw = this.originalBlocks;
        const correctOrder = this.blockAnswer.map(Number);

        this.simulatedSolution = correctOrder.map(i => rendered[i]);
        rendered.forEach((r, i) => this.microParsonToRaw.set(r, raw[i].trim()));

        this.feedbackController.solution = this.simulatedSolution;
        this.feedbackController.grader.solution = this.simulatedSolution;
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
            this.hparsonsInput.restoreAnswer(serverData.answer.blocks);
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
        if (localData.answer) {
            this.hparsonsInput.restoreAnswer(localData.answer);
        }
        if (localData.count) {
            this.feedbackController.checkCount = localData.count;
        }
        if (localData.simulatedSolution) {
            this.simulatedSolution = localData.simulatedSolution;
        }
        if (localData.microParsonToRaw) {
            this.microParsonToRaw = new Map(Object.entries(localData.microParsonToRaw));
        } else {
            this.microParsonToRaw = new Map();
        }
    }
    // RunestoneBase: Set the state of the problem in local storage
    setLocalStorage(data) {
        let currentState = {};
        if (data == undefined) {
            let userAnswer = this.hparsonsInput.getParsonsTextArray();

            // In math mode, convert microParsons to raw before caching 
            // Additionally, save the solution and microParson ➜ Raw map.
            if (this.language === "math") {
                userAnswer = userAnswer.map(sym => this.microParsonToRaw.get(sym));
                currentState = {
                    answer: userAnswer,
                    simulatedSolution: this.simulatedSolution,
                    microParsonToRaw: Object.fromEntries(this.microParsonToRaw),
                };
            } else {
                currentState = {
                    answer: userAnswer,
                };
            }
            
            if (this.isBlockGrading) {
                // if this is block grading, add number of previous attempts too
                currentState.count = this.feedbackController.checkCount;
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
$(document).on("runestone:login-complete", function () {
    $("[data-component=hparsons]").each(function () {
        if ($(this).closest("[data-component=timedAssessment]").length == 0) {
            // If this element exists within a timed component, don't render it here
            // try {
            hpList[this.id] = new HParsons({
                orig: this,
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
