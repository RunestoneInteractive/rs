// ***********************************************
// |docname| -- fill-in-the-blank client-side code
// ***********************************************
// This file contains the JS for the Runestone fillintheblank component. It was created By Isaiah Mayerchak and Kirby Olson, 6/4/15 then revised by Brad Miller, 2/7/20.
//
// Data storage notes
// ==================
//
// Initial problem restore
// -----------------------
// In the constructor, this code (the client) restores the problem by calling ``checkServer``. To do so, either the server sends or local storage has:
//
// -    seed (used only for dynamic problems)
// -    answer
// -    displayFeed (server-side grading only; otherwise, this is generated locally by client code)
// -    correct (SSG)
// -    isCorrectArray (SSG)
// -    problemHtml (SSG with dynamic problems only)
//
// If any of the answers are correct, then the client shows feedback. This is implemented in restoreAnswers_.
//
// Grading
// -------
// When the user presses the "Check me" button, the logCurrentAnswer_ function:
//
// -    Saves the following to local storage:
//
//      -   seed
//      -   answer
//      -   timestamp
//      -   problemHtml
//
//      Note that there's no point in saving displayFeed, correct, or isCorrectArray, since these values applied to the previous answer, not the new answer just submitted.
//
// -    Sends the following to the server; stop after this for client-side grading:
//
//      -   seed (ignored for server-side grading)
//      -   answer
//      -   correct (ignored for SSG)
//      -   percent (ignored for SSG)
//
// -    Receives the following from the server:
//
//      -   timestamp
//      -   displayFeed
//      -   correct
//      -   isCorrectArray
//
// -    Saves the following to local storage:
//
//      -   seed
//      -   answer
//      -   timestamp
//      -   displayFeed (SSG only)
//      -   correct (SSG only)
//      -   isCorrectArray (SSG only)
//      -   problemHtml
//
// Randomize
// ---------
// When the user presses the "Randomize" button (which is only available for dynamic problems), the randomize_ function:
//
// -    For the client-side case, sets the seed to a new, random value. For the server-side case, requests a new seed and problemHtml from the server.
// -    Sets the answer to an array of empty strings.
// -    Saves the usual local data.

"use strict";

import RunestoneBase from "../../common/js/runestonebase.js";
import { t } from "../../common/js/rsi18n.js";
import {
    renderDynamicContent,
    checkAnswersCore,
    renderDynamicFeedback,
} from "./fitb-utils.js";
import "./fitb-i18n.en.js";
import "./fitb-i18n.pt-br.js";
import "./fitb-i18n.sr-Cyrl.js";
import "../css/fitb.css";

// Object containing all instances of FITB that aren't a child of a timed assessment.
export var FITBList = {};

// FITB constructor
export default class FITB extends RunestoneBase {
    constructor(opts) {
        super(opts);
        var orig = opts.orig; // entire <p> element
        this.useRunestoneServices = opts.useRunestoneServices;
        this.origElem = orig;
        this.divid = orig.id;
        this.correct = null;
        // See comments in fitb.py for the format of ``feedbackArray`` (which is identical in both files).
        //
        // Find the script tag containing JSON and parse it. See `SO <https://stackoverflow.com/questions/9320427/best-practice-for-embedding-arbitrary-json-in-the-dom>`__. If this tag doesn't exist, then no feedback is available; server-side grading will be performed.
        //
        // A destructuring assignment would be perfect, but they don't work with ``this.blah`` and ``with`` statements aren't supported in strict mode.
        const json_element = this.scriptSelector(this.origElem);
        const dict_ = JSON.parse(json_element.textContent);
        json_element.remove();
        // Check for older versions that have raw html content.
        if (dict_.problemHtml !== undefined) {
            // if dict_.problemHtml starts with &lt; then unescape it this happens for previews
            // when the problem comes from the DB
            if (dict_.problemHtml.startsWith("&lt;")) {
                dict_.problemHtml = dict_.problemHtml
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">");
            }
            if (eBookConfig.useRunestoneServices) {
                dict_.problemHtml = dict_.problemHtml.replace(
                    /src="external/g,
                    'src="' +
                        `/ns/books/published/${eBookConfig.basecourse}` +
                        "/external",
                );
            }

            this.problemHtml = dict_.problemHtml;
            this.dyn_vars = dict_.dyn_vars;
            this.blankNames = dict_.blankNames;
            this.feedbackArray = dict_.feedbackArray;
        } else {
            this.problemHtml = this.origElem.innerHTML;
            this.feedbackArray = dict_;
        }

        this.createFITBElement();
        this.setupBlanks();
        this.caption = "Fill in the Blank";
        this.addCaption("runestone");
        this.setGroupLabel();

        // Define a promise which imports any libraries needed by dynamic problems.
        this.dyn_imports = {};
        let imports_promise = Promise.resolve();
        if (dict_.dyn_imports !== undefined) {
            // Collect all import promises.
            let import_promises = [];
            for (const import_ of dict_.dyn_imports) {
                switch (import_) {
                    // For imports known at webpack build, bring these in.
                    case "BTM":
                        import_promises.push(
                            import("btm-expressions/src/BTM_root.js"),
                        );
                        break;
                    // Allow for local imports, usually from problems defined outside the Runestone Components.
                    // Relative URL should be relative to document base, not this library
                    default:
                        const absoluteUrl = new URL(import_, document.baseURI)
                            .href;
                        import_promises.push(
                            import(/* webpackIgnore: true */ absoluteUrl),
                        );
                        break;
                }
            }

            // Combine the resulting module namespace objects when these promises resolve.
            imports_promise = Promise.all(import_promises)
                .then(
                    (module_namespace_arr) =>
                        (this.dyn_imports = Object.assign(
                            {},
                            ...module_namespace_arr,
                        )),
                )
                .catch((err) => {
                    throw `Failed dynamic import: ${err}.`;
                });
        }

        // Resolve these promises.
        imports_promise.then(() => {
            this.checkServer("fillb", false).then(() => {
                // One option for a dynamic problem is to produce a static problem by providing a fixed seed value. This is typically used when the goal is to render the problem as an image for inclusion in static content (a PDF, etc.). To support this, consider the following cases:
                //
                /// Case  Has static seed?  Is a client-side, dynamic problem?  Has local seed?  Result
                /// 0     No                No                                  X                No action needed.
                /// 1     No                Yes                                 No               this.randomize().
                /// 2     No                Yes                                 Yes              No action needed -- problem already restored from local storage.
                /// 3     Yes               No                                  X                Warning: seed ignored.
                /// 4     Yes               Yes                                 No               Assign seed; this.renderDynamicContent().
                /// 5     Yes               Yes                                 Yes              If seeds differ, issue warning. No additional action needed -- problem already restored from local storage.

                const has_static_seed = dict_.static_seed !== undefined;
                const is_client_dynamic = typeof this.dyn_vars === "string";
                const has_local_seed = this.seed !== undefined;

                // Case 1
                if (!has_static_seed && is_client_dynamic && !has_local_seed) {
                    this.randomize();
                }
                // Case 3
                else if (has_static_seed && !is_client_dynamic) {
                    console.assert(
                        false,
                        "Warning: the provided static seed was ignored, because it only affects client-side, dynamic problems.",
                    );
                }
                // Case 4
                else if (
                    has_static_seed &&
                    is_client_dynamic &&
                    !has_local_seed
                ) {
                    this.seed = dict_.static_seed;
                    this.renderDynamicContent();
                }
                // Case 5
                else if (
                    has_static_seed &&
                    is_client_dynamic &&
                    has_local_seed &&
                    this.seed !== dict_.static_seed
                ) {
                    console.assert(
                        false,
                        "Warning: the provided static seed was overridden by the seed found in local storage.",
                    );
                }
                // Cases 0 and 2
                else {
                    // No action needed.
                }

                if (typeof Prism !== "undefined") {
                    Prism.highlightAllUnder(this.containerDiv);
                }

                this.indicate_component_ready();
            });
        });
        this.typesetPrompt();
    }

    // Find the script tag containing JSON in a given root DOM node.
    scriptSelector(root_node) {
        return root_node.querySelector(`script[type="application/json"]`);
    }

    /*===========================================
    ====   Functions generating final HTML   ====
    ===========================================*/
    createFITBElement() {
        this.renderFITBInput();
        this.renderFITBButtons();
        this.renderFITBFeedbackDiv();
        // replaces the intermediate HTML for this component with the rendered HTML of this component
        this.origElem.replaceWith(this.containerDiv);
    }
    renderFITBInput() {
        // The text [input] elements are created by the template.
        this.containerDiv = document.createElement("div");
        this.containerDiv.id = this.divid;
        // Create another container which stores the problem description.
        this.descriptionDiv = document.createElement("div");
        this.descriptionDiv.classList.add("exercise-statement");
        this.containerDiv.appendChild(this.descriptionDiv);
        // Copy the original elements to the container holding what the user will see (client-side grading only).
        if (this.problemHtml) {
            this.descriptionDiv.innerHTML = this.problemHtml;
            // Save original HTML (with templates) used in dynamic problems.
            this.descriptionDiv.origInnerHTML = this.problemHtml;
        }
    }

    renderFITBButtons() {
        // "submit" button
        this.submitButton = document.createElement("button");
        this.submitButton.textContent = t("msg_fitb_check_me");
        this.submitButton.className = "btn btn-success";
        this.submitButton.name = "do answer";
        this.submitButton.type = "button";
        this.submitButton.addEventListener(
            "click",
            async function () {
                this.checkCurrentAnswer();
                await this.logCurrentAnswer();
            }.bind(this),
            false,
        );
        this.containerDiv.appendChild(this.submitButton);

        // "compare me" button
        if (this.useRunestoneServices) {
            this.compareButton = document.createElement("button");
            this.compareButton.className = "btn btn-default";
            this.compareButton.id = this.origElem.id + "_bcomp";
            this.compareButton.type = "button";
            this.compareButton.disabled = true;
            this.compareButton.name = "compare";
            this.compareButton.textContent = t("msg_fitb_compare_me");
            this.compareButton.addEventListener(
                "click",
                function () {
                    this.compareFITBAnswers();
                }.bind(this),
                false,
            );
            this.containerDiv.appendChild(this.compareButton);
        }

        // Randomize button for dynamic problems.
        if (this.dyn_vars) {
            this.randomizeButton = document.createElement("button");
            this.randomizeButton.className = "btn btn-default";
            // Not ``_bcomp``; that is the compare button's id, and dynamic
            // problems that offer both would have produced a duplicate id.
            this.randomizeButton.id = this.origElem.id + "_brand";
            this.randomizeButton.type = "button";
            this.randomizeButton.name = "randomize";
            this.randomizeButton.textContent = t("msg_fitb_randomize");
            this.randomizeButton.addEventListener(
                "click",
                function () {
                    this.randomize();
                }.bind(this),
                false,
            );
            this.containerDiv.appendChild(this.randomizeButton);
        }

        this.containerDiv.appendChild(document.createElement("div"));
    }
    renderFITBFeedbackDiv() {
        this.feedBackDiv = document.createElement("div");
        this.feedBackDiv.id = this.divid + "_feedback";
        // ``role="status"`` is an implicitly polite live region. The previous
        // ``role="alert"`` was assertive, contradicting the polite setting
        // beside it and interrupting whatever the screen reader was saying.
        this.feedBackDiv.setAttribute("role", "status");
        this.feedBackDiv.setAttribute("aria-live", "polite");
        this.feedBackDiv.setAttribute("aria-atomic", "true");
        this.feedBackDiv.classList.add("fitb-feedback");
        this.containerDiv.appendChild(this.feedBackDiv);
    }

    clearFeedbackDiv() {
        // Setting the ``outerHTML`` removes this from the DOM. Use an alternative process -- remove the class (which makes it red/green based on grading) and content.
        this.feedBackDiv.innerHTML = "";
        // Keep ``fitb-feedback``; only the alert colouring is per-grade.
        this.feedBackDiv.className = "fitb-feedback";
        this.clearBlankFeedback();
    }

    // Drop the per-blank grading state, so a stale ``aria-describedby`` never
    // points at feedback that has already been removed from the page.
    clearBlankFeedback() {
        for (const blank of this.blankArray || []) {
            blank.classList.remove("input-validation-error");
            blank.removeAttribute("aria-invalid");
            blank.removeAttribute("aria-describedby");
        }
    }

    // Update the problem's description based on dynamically-generated content.
    renderDynamicContent() {
        // ``this.dyn_vars`` can be true; if so, don't render it, since the server does all the rendering.
        if (typeof this.dyn_vars === "string") {
            let html_nodes;
            [html_nodes, this.dyn_vars_eval] = renderDynamicContent(
                this.seed,
                this.dyn_vars,
                this.dyn_imports,
                this.descriptionDiv.origInnerHTML,
                this.divid,
                this.prepareCheckAnswers.bind(this),
            );
            this.descriptionDiv.replaceChildren(...html_nodes);

            if (typeof this.dyn_vars_eval.afterContentRender === "function") {
                try {
                    this.dyn_vars_eval.afterContentRender(this.dyn_vars_eval);
                } catch (err) {
                    console.assert(
                        false,
                        `Error in problem ${this.divid} invoking afterContentRender`,
                    );
                    throw err;
                }
            }

            this.setupBlanks();
        }
    }

    setupBlanks() {
        // Find and format the blanks. If a dynamic problem just changed the HTML, this will find the newly-created blanks.
        // WARNING - this assumes that all text/number inputs in the descriptionDiv are the blanks.
        // Ideally, there should be some unique attribute that can be used to select the blanks.
        const ba = this.descriptionDiv.querySelectorAll(
            'input[type="text"],input[type="number"]',
        );
        ba.forEach((el) => {
            el.className = "form form-control selectwidthauto";
        });
        this.blankArray = Array.from(ba);
        for (let blank of this.blankArray) {
            blank.addEventListener("change", this.recordAnswered.bind(this));
        }
        this.labelBlanks();
    }

    /*========================================
    ====  Accessible names for the blanks  ====
    ========================================*/
    // Name the exercise as a whole, so entering it announces what it is rather
    // than an anonymous group of text boxes.
    setGroupLabel() {
        this.containerDiv.setAttribute("role", "group");
        this.containerDiv.setAttribute(
            "aria-label",
            this.question_label
                ? t("msg_fitb_group_label_numbered", this.question_label)
                : t("msg_fitb_group_label"),
        );
    }

    // A screen reader announces a form field's accessible name when focus lands
    // on it and nothing else -- the prompt text around the field is never read
    // in forms mode. Every blank was named "input area", so tabbing into a
    // question said nothing about the question. Build each name out of the
    // prompt instead, spelling out every blank in that prompt as "blank 1",
    // "blank 2", ... so the gaps have audible positions.
    labelBlanks() {
        const total = this.blankArray.length;
        this.blankArray.forEach((blank, i) => {
            const context = this.blankContext(blank, i);
            let label;
            if (total === 1) {
                label = context
                    ? t("msg_fitb_blank_label_single", context)
                    : t("msg_fitb_blank_fallback_single");
            } else {
                label = context
                    ? t("msg_fitb_blank_label", i + 1, total, context)
                    : t("msg_fitb_blank_fallback", i + 1, total);
            }
            blank.setAttribute("aria-label", label);
        });
    }

    // The prompt text to read out for blank ``i``.
    blankContext(blank, i) {
        const block = this.blankBlock(blank);
        let text = this.blankContextText(block);
        // Newlines are only significant in a code listing, and there the useful
        // context is the blank's own line: reading a whole program aloud on
        // every Tab is as unusable as reading nothing. Fall back to the entire
        // listing for a blank that sits alone on its line, which says nothing
        // by itself.
        if (block.tagName.toLowerCase() === "pre") {
            const marker = t("msg_fitb_blank_n", i + 1);
            const line = text.split("\n").find((l) => l.includes(marker));
            if (line !== undefined && line.replace(marker, "").trim()) {
                text = line;
            }
        }
        return (
            text
                .replace(/\s+/g, " ")
                // A blank is padded with spaces so it never runs into the words
                // beside it; pull the padding back off punctuation, which
                // otherwise reads as "blank 1 , then".
                .replace(/\s+([,.;:!?)\]}])/g, "$1")
                .trim()
        );
    }

    // The block the blank sits in -- its sentence, list item or table cell --
    // which is the useful unit of context. Falls back to the whole prompt.
    blankBlock(blank) {
        const block = blank.closest(
            "p,li,dd,dt,td,th,pre,blockquote,section,div,h1,h2,h3,h4,h5,h6",
        );
        return block && this.descriptionDiv.contains(block)
            ? block
            : this.descriptionDiv;
    }

    // Flatten an element into the text a screen reader would hear, with each
    // blank replaced by its spoken number. Whitespace is not normalized here.
    blankContextText(root) {
        const parts = [];
        const walk = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                parts.push(node.nodeValue);
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return;
            }
            // Skip whatever is already hidden from assistive technology. This
            // also drops MathJax's visual output, leaving its assistive MathML.
            if (node.getAttribute("aria-hidden") === "true") {
                return;
            }
            const tag = node.tagName.toLowerCase();
            if (tag === "script" || tag === "style" || tag === "template") {
                return;
            }
            const blankIndex = this.blankArray.indexOf(node);
            if (blankIndex !== -1) {
                parts.push(` ${t("msg_fitb_blank_n", blankIndex + 1)} `);
                return;
            }
            if (tag === "br") {
                parts.push(" ");
                return;
            }
            if (tag === "img") {
                parts.push(` ${node.getAttribute("alt") || ""} `);
                return;
            }
            if (tag === "input" || tag === "select" || tag === "textarea") {
                // Some other control the author put in the prompt: read the
                // name it carries rather than descending into it.
                parts.push(` ${node.getAttribute("aria-label") || ""} `);
                return;
            }
            for (const child of node.childNodes) {
                walk(child);
            }
        };
        walk(root);
        // Whitespace is left as-is; the caller decides whether newlines matter.
        return parts.join("");
    }

    // MathJax rewrites the prompt asynchronously, after the blanks have been
    // named; rebuild the names once it is done so they hold the typeset text
    // instead of raw LaTeX.
    typesetPrompt() {
        return this.queueMathJax(this.descriptionDiv).then(() =>
            this.labelBlanks(),
        );
    }

    // This tells timed questions that the fitb blanks received some interaction.
    recordAnswered() {
        this.isAnswered = true;
    }

    /*===================================
    === Checking/loading from storage ===
    ===================================*/
    restoreAnswers(data) {
        // Restore the seed first, since the dynamic render clears all the blanks.
        this.seed = data.seed;
        this.renderDynamicContent();
        this.typesetPrompt();

        var arr;
        // Restore answers from storage retrieval done in RunestoneBase.
        try {
            // The newer format encodes data as a JSON object.
            arr = JSON.parse(data.answer);
            // The result should be an array. If not, try comma parsing instead.
            if (!Array.isArray(arr)) {
                throw new Error();
            }
        } catch (err) {
            // The old format didn't.
            arr = (data.answer || "").split(",");
        }
        let hasAnswer = false;
        for (var i = 0; i < this.blankArray.length; i++) {
            this.blankArray[i].value = arr[i] || "";
            if (arr[i]) {
                hasAnswer = true;
            }
        }
        // Is this client-side grading, or server-side grading?
        if (this.feedbackArray) {
            // For client-side grading, re-generate feedback if there's an answer.
            if (hasAnswer) {
                this.checkCurrentAnswer();
            }
        } else {
            // For server-side grading, use the provided feedback from the server or local storage.
            this.displayFeed = data.displayFeed;
            this.correct = data.correct;
            this.isCorrectArray = data.isCorrectArray;
            // Only render if all the data is present; local storage might have old data missing some of these items.
            if (
                typeof this.displayFeed !== "undefined" &&
                typeof this.correct !== "undefined" &&
                typeof this.isCorrectArray !== "undefined"
            ) {
                this.renderFeedback();
            }
            // For server-side dynamic problems, show the rendered problem text.
            this.problemHtml = data.problemHtml;
            if (this.problemHtml) {
                this.descriptionDiv.innerHTML = this.problemHtml;
                this.typesetPrompt();
                this.setupBlanks();
            }
        }
    }

    checkLocalStorage() {
        // Loads previous answers from local storage if they exist
        var storedData;
        if (this.graderactive) {
            return;
        }
        var len = localStorage.length;
        if (len > 0) {
            var ex = localStorage.getItem(this.localStorageKey());
            if (ex !== null) {
                let error = false;
                try {
                    storedData = JSON.parse(ex);
                } catch (err) {
                    // error while parsing; likely due to bad value stored in storage
                    console.log(
                        `Error parsing stored FITB data for ${this.divid}: ${err.message}`,
                    );
                    error = true;
                }
                if (error || storedData.timestamp < eBookConfig.termStartDate) {
                    localStorage.removeItem(this.localStorageKey());
                    return;
                }
                this.restoreAnswers(storedData);
            }
        }
    }

    setLocalStorage(data) {
        let key = this.localStorageKey();
        localStorage.setItem(key, JSON.stringify(data));
    }

    checkCurrentAnswer() {
        // Start of the evaluation chain
        this.isCorrectArray = [];
        this.displayFeed = [];
        const pca = this.prepareCheckAnswers();

        if (this.useRunestoneServices) {
            if (eBookConfig.enableCompareMe) {
                this.enableCompareButton();
            }
        }

        // Grade locally if we can't ask the server to grade.
        if (this.feedbackArray) {
            [
                // An array of HTML feedback.
                this.displayFeed,
                // true, false, or null (the question wasn't answered).
                this.correct,
                // An array of true, false, or null (the question wasn't answered).
                this.isCorrectArray,
                this.percent,
            ] = checkAnswersCore(...pca);
            if (!this.isTimed) {
                this.renderFeedback();
            }
        }
    }

    // Inputs:
    //
    // - Strings entered by the student in ``this.blankArray[i].value``.
    // - Feedback in ``this.feedbackArray``.
    prepareCheckAnswers() {
        this.given_arr = [];
        for (var i = 0; i < this.blankArray.length; i++)
            this.given_arr.push(this.blankArray[i].value);
        return [
            this.blankNames,
            this.given_arr,
            this.feedbackArray,
            this.dyn_vars_eval,
        ];
    }

    // _`randomize`: This handles a click to the "Randomize" button.
    async randomize() {
        // Use the client-side case or the server-side case?
        if (this.feedbackArray) {
            // This is the client-side case.
            //
            this.seed = Math.floor(Math.random() * 2 ** 32);
            this.renderDynamicContent();
            this.typesetPrompt();
        } else {
            // This is the server-side case. Send a request to the `results <getAssessResults>` endpoint with ``new_seed`` set to True.
            const request = new Request("/assessment/results", {
                method: "POST",
                body: JSON.stringify({
                    div_id: this.divid,
                    course: eBookConfig.course,
                    event: "fillb",
                    sid: this.sid,
                    new_seed: true,
                }),
                headers: this.jsonHeaders,
            });
            const response = await fetch(request);
            if (!response.ok) {
                alert(`HTTP error getting results: ${response.statusText}`);
                return;
            }
            const data = await response.json();
            const res = data.detail;
            this.seed = res.seed;
            this.descriptionDiv.innerHTML = res.problemHtml;
            this.typesetPrompt();
            this.setupBlanks();
        }
        // When getting a new seed, clear all the old answers and feedback.
        this.given_arr = Array(this.blankArray.length).fill("");
        this.blankArray.forEach((el) => (el.value = ""));
        this.clearFeedbackDiv();
        this.saveAnswersLocallyOnly();
    }

    // Save the answers and associated data locally; don't save feedback provided by the server for this answer. It assumes that ``this.given_arr`` contains the current answers.
    saveAnswersLocallyOnly() {
        this.setLocalStorage({
            // The seed is used for client-side operation, but doesn't matter for server-side.
            seed: this.seed,
            answer: JSON.stringify(this.given_arr),
            timestamp: new Date(),
            // This is only needed for server-side grading with dynamic problems.
            problemHtml: this.descriptionDiv.innerHTML,
        });
    }

    // _`logCurrentAnswer`: Save the current state of the problem to local storage and the server; display server feedback.
    async logCurrentAnswer(sid) {
        let answer = JSON.stringify(this.given_arr);
        let feedback = true;
        // Save the answer locally.
        this.saveAnswersLocallyOnly();
        // Save the answer to the server.
        const data = {
            event: "fillb",
            div_id: this.divid,
            act: answer || "",
            seed: this.seed,
            answer: answer || "",
            correct: this.correct ? "T" : "F",
            percent: this.percent,
        };
        if (typeof sid !== "undefined") {
            data.sid = sid;
            feedback = false;
        }
        const server_data = await this.logBookEvent(data);
        if (!feedback) return;
        // Non-server side graded problems are done at this point; likewise, stop here if the server didn't respond.
        if (this.feedbackArray || !server_data) {
            return data;
        }
        // This is the server-side case. On success, update the feedback from the server's grade.
        const res = server_data.detail;
        this.timestamp = res.timestamp;
        this.displayFeed = res.displayFeed;
        this.correct = res.correct;
        this.isCorrectArray = res.isCorrectArray;
        this.setLocalStorage({
            seed: this.seed,
            answer: answer,
            timestamp: this.timestamp,
            problemHtml: this.descriptionDiv.innerHTML,
            displayFeed: this.displayFeed,
            correct: this.correct,
            isCorrectArray: this.isCorrectArray,
        });
        this.renderFeedback();
        return server_data;
    }

    /*==============================
    === Evaluation of answer and ===
    ===     display feedback     ===
    ==============================*/
    renderFeedback() {
        // Start from a clean slate: a previous grade may have left an
        // ``aria-describedby`` pointing at feedback about to be replaced.
        this.clearBlankFeedback();
        if (this.correct) {
            this.feedBackDiv.className = "alert alert-info fitb-feedback";
        } else {
            if (this.displayFeed === null) {
                this.displayFeed = "";
            }
            this.feedBackDiv.className = "alert alert-danger fitb-feedback";
        }
        // Mark the blanks themselves. The red border is invisible to a screen
        // reader; ``aria-invalid`` is what it reports when focus returns.
        for (let j = 0; j < this.blankArray.length; j++) {
            const wrong = !this.correct && this.isCorrectArray[j] !== true;
            this.blankArray[j].classList.toggle(
                "input-validation-error",
                wrong,
            );
            this.blankArray[j].setAttribute(
                "aria-invalid",
                wrong ? "true" : "false",
            );
        }

        // A single piece of feedback is not a list; don't make a screen reader
        // announce "list, 1 item" for it.
        const single = this.displayFeed.length === 1;
        const list = single
            ? document.createDocumentFragment()
            : document.createElement("ul");
        for (var i = 0; i < this.displayFeed.length; i++) {
            let df = this.displayFeed[i];
            const ok = this.isCorrectArray[i] === true;
            // Render any dynamic feedback in the provided feedback, for client-side grading of dynamic problems.
            if (typeof this.dyn_vars === "string") {
                df = renderDynamicFeedback(
                    this.blankNames,
                    this.given_arr,
                    i,
                    df,
                    this.dyn_vars_eval,
                );
                // Convert the returned NodeList into a string of HTML.
                df =
                    df?.[0] !== undefined
                        ? df[0].parentElement.innerHTML
                        : "No feedback provided";
            }
            const item = document.createElement(single ? "span" : "li");
            item.id = `${this.divid}_feedback_${i}`;
            // The check or cross is decoration -- screen readers either skip it
            // or read the emoji's name. Hide it and say the word instead.
            const mark = document.createElement("span");
            mark.setAttribute("aria-hidden", "true");
            mark.textContent = ok ? "✔️" : "✖️";
            const spoken = document.createElement("span");
            spoken.className = "fitb-sr-only";
            spoken.textContent = `${
                ok ? t("msg_fitb_correct") : t("msg_fitb_incorrect")
            } `;
            const body = document.createElement("span");
            body.innerHTML = df ?? "";
            item.append(mark, document.createTextNode(" "), spoken, body);
            list.appendChild(item);
            // Tie the feedback to the blank it grades, so tabbing back into a
            // wrong answer repeats why it was wrong.
            if (this.blankArray[i]) {
                this.blankArray[i].setAttribute("aria-describedby", item.id);
            }
        }
        this.feedBackDiv.innerHTML = "";
        if (this.displayFeed.length > 1) {
            // With several blanks the per-blank marks are easy to lose track
            // of; lead the announcement with the overall verdict.
            const summary = document.createElement("div");
            summary.className = "fitb-sr-only";
            summary.textContent = this.correct
                ? t("msg_fitb_result_correct")
                : t("msg_fitb_result_incorrect");
            this.feedBackDiv.appendChild(summary);
        }
        this.feedBackDiv.appendChild(list);
        this.queueMathJax(this.feedBackDiv);
    }

    /*==================================
    === Functions for compare button ===
    ==================================*/
    enableCompareButton() {
        this.compareButton.disabled = false;
    }
    // _`compareFITBAnswers`
    async compareFITBAnswers() {
        var data = {};
        data.div_id = this.divid;
        data.course = eBookConfig.course;
        try {
            const params = new URLSearchParams(data);
            const resp = await fetch(
                `${eBookConfig.new_server_prefix}/assessment/gettop10Answers?${params.toString()}`,
            );
            const json = await resp.json();
            this.compareFITB(json);
        } catch (e) {
            console.error("Error fetching top answers:", e);
        }
    }
    compareFITB(data, status, whatever) {
        const answers = data.detail.res;
        const titleId = `${this.divid}_compare_title`;
        // A real header row, marked up as one, so a screen reader can announce
        // the column when reading down the table.
        let body = "<table><thead><tr>";
        body += "<th scope='col'>Answer</th><th scope='col'>Count</th>";
        body += "</tr></thead><tbody>";
        for (const row in answers) {
            body +=
                "<tr><td>" +
                answers[row].answer +
                "</td><td>" +
                answers[row].count +
                " times</td></tr>";
        }
        body += "</tbody></table>";

        // Simple modal without Bootstrap/jQuery
        const previouslyFocused = document.activeElement;
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.background = "rgba(0,0,0,0.5)";
        overlay.style.zIndex = "9999";

        const dialog = document.createElement("div");
        dialog.className = "compare-modal";
        // Announce this as a dialog named by its heading, and hide the page
        // behind it from assistive technology while it is open.
        dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", titleId);
        dialog.tabIndex = -1;
        dialog.style.maxWidth = "720px";
        dialog.style.margin = "10vh auto";
        dialog.style.background = "#fff";
        dialog.style.borderRadius = "6px";
        dialog.style.boxShadow = "0 2px 12px rgba(0,0,0,0.3)";
        dialog.style.padding = "16px";

        const close = () => {
            document.removeEventListener("keydown", onKeydown, true);
            overlay.remove();
            // Put the user back where they were, not at the top of the page.
            if (previouslyFocused && previouslyFocused.focus) {
                previouslyFocused.focus();
            }
        };
        // Escape closes, and Tab cycles inside the dialog: ``aria-modal`` tells
        // a screen reader the rest of the page is inert, but does not keep the
        // keyboard from tabbing out into it.
        const onKeydown = (ev) => {
            if (ev.key === "Escape") {
                ev.preventDefault();
                close();
                return;
            }
            if (ev.key !== "Tab") {
                return;
            }
            const focusable = dialog.querySelectorAll(
                "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
            );
            if (!focusable.length) {
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (ev.shiftKey && document.activeElement === first) {
                ev.preventDefault();
                last.focus();
            } else if (!ev.shiftKey && document.activeElement === last) {
                ev.preventDefault();
                first.focus();
            }
        };

        const header = document.createElement("div");
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        // The glyph is decoration; the button needs a name that can be spoken.
        const closeGlyph = document.createElement("span");
        closeGlyph.setAttribute("aria-hidden", "true");
        closeGlyph.textContent = "\u00d7";
        closeBtn.appendChild(closeGlyph);
        closeBtn.setAttribute("aria-label", t("msg_fitb_close"));
        closeBtn.style.float = "right";
        closeBtn.className = "btn btn-light";
        closeBtn.onclick = close;
        const title = document.createElement("h4");
        title.className = "modal-title";
        title.id = titleId;
        title.textContent = t("msg_fitb_top_answers");
        header.appendChild(closeBtn);
        header.appendChild(title);

        const modalBody = document.createElement("div");
        modalBody.innerHTML = body;

        dialog.appendChild(header);
        dialog.appendChild(modalBody);
        overlay.appendChild(dialog);
        overlay.addEventListener("click", (ev) => {
            if (ev.target === overlay) {
                close();
            }
        });
        document.body.appendChild(overlay);
        document.addEventListener("keydown", onKeydown, true);
        dialog.focus();
    }

    disableInteraction() {
        for (var i = 0; i < this.blankArray.length; i++) {
            // Read-only rather than disabled: a disabled input is skipped by
            // the keyboard and by screen readers, so a student reviewing a
            // finished timed exam could no longer hear what they answered.
            this.blankArray[i].readOnly = true;
            this.blankArray[i].setAttribute("aria-disabled", "true");
        }
    }
}

/*=================================
== Find the custom HTML tags and ==
==   execute our code on them    ==
=================================*/
document.addEventListener("runestone:login-complete", function () {
    document
        .querySelectorAll("[data-component=fillintheblank]")
        .forEach(function (el, index) {
            var opts = {
                orig: el,
                useRunestoneServices: eBookConfig.useRunestoneServices,
            };
            if (!el.closest("[data-component=timedAssessment]")) {
                // If this element exists within a timed component, don't render it here
                try {
                    FITBList[el.id] = new FITB(opts);
                    window.componentMap[el.id] = FITBList[el.id];
                } catch (err) {
                    console.assert(
                        false,
                        `Error rendering Fill in the Blank Problem ${el.id}
                     Details: ${err}`,
                    );
                }
            }
        });
});
