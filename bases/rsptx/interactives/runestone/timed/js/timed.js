/*==========================================
========      Master timed.js     =========
============================================
===     This file contains the JS for    ===
===     the Runestone timed component.   ===
============================================
===              Created By              ===
===             Kirby Olson              ===
===               6/11/15                ===
==========================================*/
"use strict";

import RunestoneBase from "../../common/js/runestonebase.js";
import TimedFITB from "../../fitb/js/timedfitb.js";
import TimedMC from "../../mchoice/js/timedmc.js";
import TimedShortAnswer from "../../shortanswer/js/timed_shortanswer.js";
import ACFactory from "../../activecode/js/acfactory.js";
import TimedClickableArea from "../../clickableArea/js/timedclickable";
import TimedDragNDrop from "../../dragndrop/js/timeddnd.js";
import TimedParsons from "../../parsons/js/timedparsons.js";
import TimedMatching from "../../matching/js/timed_matching.js";
import SelectOne from "../../selectquestion/js/selectone";
import { getDataValue } from "../../common/js/domutil.js";
import "../css/timed.less";

// Timed constructor
export default class Timed extends RunestoneBase {
    constructor(opts) {
        super(opts);
        var orig = opts.orig;
        this.origElem = orig; // the entire element of this timed assessment and all of its children
        this.divid = orig.id;
        this.children = this.origElem.childNodes;
        this.visited = [];
        this.timeLimit = 0;
        this.limitedTime = false;
        if (!isNaN(getDataValue(this.origElem, "time"))) {
            this.timeLimit =
                parseInt(getDataValue(this.origElem, "time"), 10) * 60; // time in seconds to complete the exam
            this.startingTime = this.timeLimit;
            this.limitedTime = true;
        }
        this.showFeedback = true;
        if (this.origElem.hasAttribute("data-no-feedback")) {
            this.showFeedback = false;
        }
        // check for attribute data-show-feedback = yes
        if (this.origElem.hasAttribute("data-show-feedback")) {
            if (this.origElem.getAttribute("data-show-feedback") === "yes") {
                this.showFeedback = true;
            } else {
                this.showFeedback = false;
            }
        }
        this.showResults = false;
        if (this.origElem.hasAttribute("data-result")) {
            this.showResults = false;
        }
        this.random = false;
        if (this.origElem.hasAttribute("data-random")) {
            this.random = true;
        }
        this.showTimer = true;
        if (this.origElem.hasAttribute("data-no-timer")) {
            this.showTimer = false;
        }
        if (this.origElem.hasAttribute("data-timer")) {
            if (this.origElem.getAttribute("data-timer") === "yes") {
                this.showTimer = true;
            } else {
                this.showTimer = false;
            }
        }
        this.fullwidth = false;
        if (this.origElem.hasAttribute("data-fullwidth")) {
            this.fullwidth = true;
        }
        this.nopause = false;
        if (this.origElem.hasAttribute("data-no-pause")) {
            this.nopause = true;
        }
        if (this.origElem.hasAttribute("data-pause")) {
            if (this.origElem.getAttribute("data-pause") === "yes") {
                this.nopause = false;
            } else {
                this.nopause = true;
            }
        }
        eBookConfig.enableScratchAC = false;
        this.running = 0;
        this.paused = 0;
        this.done = 0;
        this.taken = 0;
        this.score = 0;
        this.incorrect = 0;
        this.correctStr = "";
        this.incorrectStr = "";
        this.skippedStr = "";
        this.skipped = 0;
        this.currentQuestionIndex = 0; // Which question is currently displaying on the page
        this.renderedQuestionArray = []; // list of all problems
        this.getNewChildren();
        // One small step to eliminate students from doing view source
        // this won't stop anyone with determination but may prevent casual peeking
        if (!eBookConfig.enableDebug) {
            document.body.oncontextmenu = function () {
                return false;
            };
        }
        this.checkAssessmentStatus().then(
            function () {
                this.renderTimedAssess();
            }.bind(this),
        );
    }

    getNewChildren() {
        this.newChildren = [];
        let runestoneChildren = this.origElem.querySelectorAll(".runestone");
        for (var i = 0; i < runestoneChildren.length; i++) {
            this.newChildren.push(runestoneChildren[i]);
        }
    }

    async checkAssessmentStatus() {
        // Has the user taken this exam?  Inquiring minds want to know
        // If a user has not taken this exam then we want to make sure
        // that if a question has been seen by the student before we do
        // not populate previous answers.
        let sendInfo = {
            div_id: this.divid,
            course_name: eBookConfig.course,
        };
        console.log(sendInfo);
        if (eBookConfig.useRunestoneServices) {
            let request = new Request(
                `${eBookConfig.new_server_prefix}/assessment/tookTimedAssessment`,
                {
                    method: "POST",
                    headers: this.jsonHeaders,
                    body: JSON.stringify(sendInfo),
                },
            );
            let response = await fetch(request);
            let data = await response.json();
            data = data.detail;
            this.taken = data.tookAssessment;
            this.assessmentTaken = this.taken;
            if (!this.taken) {
                localStorage.clear();
            }
            console.log("done with check status");
            return response;
        } else {
            this.taken = false;
            this.assessmentTaken = false;
            return Promise.resolve();
        }
    }

    /*===============================
    === Generating new Timed HTML ===
    ===============================*/
    async renderTimedAssess() {
        console.log("rendering timed ");
        // create renderedQuestionArray returns a promise
        //
        this.createRenderedQuestionArray();
        if (this.random) {
            this.randomizeRQA();
        }
        this.renderContainer();
        this.renderTimer();
        await this.renderControlButtons();
        // If we decide to disable cut/copy/paste, uncomment the line below
        // this.disableCutCopyPaste();
        this.containerDiv.appendChild(this.timedDiv); // This can't be appended in renderContainer because then it renders above the timer and control buttons.
        if (this.renderedQuestionArray.length > 1) this.renderNavControls();
        this.renderSubmitButton();
        this.renderFeedbackContainer();
        this.useRunestoneServices = eBookConfig.useRunestoneServices;
        // Replace intermediate HTML with rendered HTML
        this.origElem.replaceWith(this.containerDiv);
        // check if already taken and if so show results
        this.styleExamElements(); // rename to renderPossibleResults
        this.checkServer("timedExam", true);
    }

    disableCutCopyPaste() {
        document.addEventListener("cut", function (e) {
            e.preventDefault();
        });
        document.addEventListener("copy", function (e) {
            e.preventDefault();
        });
        document.addEventListener("paste", function (e) {
            e.preventDefault();
        });
    }

    renderContainer() {
        this.containerDiv = document.createElement("div"); // container for the entire Timed Component
        if (this.fullwidth) {
            // allow the container to fill the width - barb
            this.containerDiv.classList.add("timed-container-fullwidth");
        }
        this.containerDiv.classList.add("runestone-sphinx");
        this.containerDiv.id = this.divid;
        this.timedDiv = document.createElement("div"); // div that will hold the questions for the timed assessment
        this.navDiv = document.createElement("div"); // For navigation control
        this.navDiv.classList.add("timed-center");
        this.flagDiv = document.createElement("div"); // div that will hold the "Flag Question" button
        this.flagDiv.classList.add("timed-center");
        this.switchContainer = document.createElement("div");
        this.switchContainer.classList.add("switchcontainer");
        this.switchContainer.classList.add("ptx-runestone-container");
        this.switchDiv = document.createElement("div"); // is replaced by the questions
        this.timedDiv.appendChild(this.navDiv);
        this.timedDiv.appendChild(this.flagDiv); // add flagDiv to timedDiv, which holds components for navigation and questions for timed assessment
        this.timedDiv.appendChild(this.switchContainer);
        this.switchContainer.appendChild(this.switchDiv);
        this.timedDiv.id = "timed_Test";
        this.timedDiv.classList.add("timed-hidden");
    }

    renderTimer() {
        this.wrapperDiv = document.createElement("div");
        this.timerContainer = document.createElement("P");
        this.wrapperDiv.id = this.divid + "-startWrapper";
        this.timerContainer.id = this.divid + "-output";
        this.wrapperDiv.appendChild(this.timerContainer);
        this.showTime();
    }

    renderControlButtons() {
        this.controlDiv = document.createElement("div");
        this.controlDiv.id = "controls";
        this.controlDiv.classList.add("timed-center");
        this.startBtn = document.createElement("button");
        this.pauseBtn = document.createElement("button");
        this.startBtn.setAttribute("class", "btn btn-success");
        this.startBtn.id = "start";
        this.startBtn.tabIndex = 0;
        this.startBtn.setAttribute("role", "button");
        this.startBtn.textContent = "Start";
        this.startBtn.addEventListener(
            "click",
            async function () {
                this.finishButton.classList.add("timed-hidden"); // hide the finish button for now
                if (this.flagButton) {
                    this.flagButton.classList.remove("timed-hidden");
                }
                let mess = document.createElement("p");
                mess.innerHTML =
                    "<strong>Warning: You will not be able to continue the exam if you close this tab, close the window, or navigate away from this page!</strong>  Make sure you click the Finish Exam button when you are done to submit your work!";
                this.controlDiv.appendChild(mess);
                mess.classList.add("examwarning");
                await this.renderTimedQuestion();
                this.startAssessment();
            }.bind(this),
            false,
        );
        this.pauseBtn.setAttribute("class", "btn btn-default");
        this.pauseBtn.id = "pause";
        this.pauseBtn.disabled = true;
        this.pauseBtn.tabIndex = 0;
        this.pauseBtn.setAttribute("role", "button");
        this.pauseBtn.textContent = "Pause";
        this.pauseBtn.addEventListener(
            "click",
            function () {
                this.pauseAssessment();
            }.bind(this),
            false,
        );
        if (!this.taken) {
            this.controlDiv.appendChild(this.startBtn);
        }
        if (!this.nopause) {
            this.controlDiv.appendChild(this.pauseBtn);
        }
        this.containerDiv.appendChild(this.wrapperDiv);
        this.containerDiv.appendChild(this.controlDiv);
    }

    renderNavControls() {
        // making "Prev" button
        this.pagNavList = document.createElement("ul");
        this.pagNavList.classList.add("pagination");
        this.leftContainer = document.createElement("li");
        this.leftNavButton = document.createElement("button");
        this.leftNavButton.innerHTML = "&#8249; Prev";
        this.leftNavButton.setAttribute("aria-label", "Previous");
        this.leftNavButton.tabIndex = 0;
        this.leftNavButton.setAttribute("role", "button");
        this.leftNavButton.classList.add("timed-cursor-pointer");
        this.leftContainer.appendChild(this.leftNavButton);
        this.pagNavList.appendChild(this.leftContainer);
        // making "Flag Question" button
        this.flaggingPlace = document.createElement("ul");
        this.flaggingPlace.classList.add("pagination");
        this.flagContainer = document.createElement("li");
        this.flagButton = document.createElement("button");
        this.flagButton.classList.add("flagBtn");
        this.flagButton.innerHTML = "Flag Question"; // name on button
        this.flagButton.setAttribute("aria-labelledby", "Flag");
        this.flagButton.tabIndex = 5;
        this.flagButton.setAttribute("role", "button");
        this.flagButton.id = "flag";
        this.flagButton.classList.add("timed-cursor-pointer");
        this.flagContainer.appendChild(this.flagButton); // adding button to container
        this.flaggingPlace.appendChild(this.flagContainer); // adding container to flaggingPlace
        // making "Next" button
        this.rightContainer = document.createElement("li");
        this.rightNavButton = document.createElement("button");
        this.rightNavButton.setAttribute("aria-label", "Next");
        this.rightNavButton.tabIndex = 0;
        this.rightNavButton.setAttribute("role", "button");
        this.rightNavButton.id = "next";
        this.rightNavButton.innerHTML = "Next &#8250;";
        this.rightNavButton.classList.add("timed-cursor-pointer");
        this.rightContainer.appendChild(this.rightNavButton);
        this.pagNavList.appendChild(this.rightContainer);
        this.ensureButtonSafety();
        this.navDiv.appendChild(this.pagNavList);
        this.flagDiv.appendChild(this.flaggingPlace); // adds flaggingPlace to the flagDiv
        this.break = document.createElement("br");
        this.navDiv.appendChild(this.break);
        // render the question number jump buttons
        this.qNumList = document.createElement("ul");
        this.qNumList.id = "pageNums";
        this.qNumWrapperList = document.createElement("ul");
        this.qNumWrapperList.classList.add("pagination");
        var tmpLi, tmpA;
        for (var i = 0; i < this.renderedQuestionArray.length; i++) {
            tmpLi = document.createElement("li");
            tmpA = document.createElement("a");
            tmpA.innerHTML = i + 1;
            tmpA.classList.add("timed-cursor-pointer");
            if (i === 0) {
                tmpLi.classList.add("active");
            }
            tmpLi.appendChild(tmpA);
            this.qNumWrapperList.appendChild(tmpLi);
        }
        this.qNumList.appendChild(this.qNumWrapperList);
        this.navDiv.appendChild(this.qNumList);
        this.navBtnListeners();
        this.flagBtnListener(); // listens for click on flag button
        this.flagButton.classList.add("timed-hidden");
    }

    // The li for question number `index` in the numbered navigation strip.
    qNumItem(index) {
        return document.querySelectorAll("ul#pageNums > ul > li")[index];
    }

    // when moving off of a question in an active exam:
    // 1. show that the question has been seen, or mark it broken if it is in error.
    // 2. check and log the current answer
    async navigateAway() {
        if (
            this.renderedQuestionArray[this.currentQuestionIndex].state ==
            "broken_exam"
        ) {
            this.qNumItem(this.currentQuestionIndex)?.classList.add("broken");
        }
        if (
            this.renderedQuestionArray[this.currentQuestionIndex].state ==
            "exam_ended"
        ) {
            this.qNumItem(this.currentQuestionIndex)?.classList.add("toolate");
        }
        if (
            this.renderedQuestionArray[this.currentQuestionIndex].question
                .isAnswered
        ) {
            this.qNumItem(this.currentQuestionIndex)?.classList.add(
                "answered",
            );
            await this.renderedQuestionArray[
                this.currentQuestionIndex
            ].question.checkCurrentAnswer();
            if (!this.done) {
                await this.renderedQuestionArray[
                    this.currentQuestionIndex
                ].question.logCurrentAnswer();
            }
        }
    }
    async handleNextPrev(event) {
        if (!this.taken) {
            await this.navigateAway();
        }
        var target = event.target.textContent;
        if (target.match(/Next/)) {
            // checks given text to match "Next"
            if (this.rightContainer.classList.contains("disabled")) {
                return;
            }
            this.currentQuestionIndex++;
        } else if (target.match(/Prev/)) {
            // checks given text to match "Prev"
            if (this.leftContainer.classList.contains("disabled")) {
                return;
            }
            this.currentQuestionIndex--;
        }
        await this.renderTimedQuestion();
        this.ensureButtonSafety();
        for (var i = 0; i < this.qNumList.childNodes.length; i++) {
            for (
                var j = 0;
                j < this.qNumList.childNodes[i].childNodes.length;
                j++
            ) {
                this.qNumList.childNodes[i].childNodes[j].classList.remove(
                    "active",
                );
            }
        }
        let currentItem = this.qNumItem(this.currentQuestionIndex);
        currentItem?.classList.add("active");
        if (currentItem?.classList.contains("flagcolor")) {
            // checking for class
            this.flagButton.innerHTML = "Unflag Question"; // changes text on button
        } else {
            this.flagButton.innerHTML = "Flag Question"; // changes text on button
        }
    }

    async handleFlag(event) {
        // called when flag button is clicked
        var target = event.target.textContent;
        if (target.match(/Flag Question/)) {
            // class will change color of question block
            this.qNumItem(this.currentQuestionIndex)?.classList.add(
                "flagcolor",
            );
            this.flagButton.innerHTML = "Unflag Question";
        } else {
            // will restore current color of question block
            this.qNumItem(this.currentQuestionIndex)?.classList.remove(
                "flagcolor",
            );
            this.flagButton.innerHTML = "Flag Question"; // also sets name back
        }
    }

    async handleNumberedNav(event) {
        if (!this.taken) {
            await this.navigateAway();
        }
        for (var i = 0; i < this.qNumList.childNodes.length; i++) {
            for (
                var j = 0;
                j < this.qNumList.childNodes[i].childNodes.length;
                j++
            ) {
                this.qNumList.childNodes[i].childNodes[j].classList.remove(
                    "active",
                );
            }
        }

        var target = event.target.textContent;
        let oldIndex = this.currentQuestionIndex;
        this.currentQuestionIndex = parseInt(target) - 1;
        if (this.currentQuestionIndex > this.renderedQuestionArray.length) {
            console.log(`Error: bad index for ${target}`);
            this.currentQuestionIndex = oldIndex;
        }
        let currentItem = this.qNumItem(this.currentQuestionIndex);
        currentItem?.classList.add("active");
        if (currentItem?.classList.contains("flagcolor")) {
            this.flagButton.innerHTML = "Unflag Question";
        } else {
            this.flagButton.innerHTML = "Flag Question";
        }
        await this.renderTimedQuestion();
        this.ensureButtonSafety();
    }

    // set up events for navigation
    navBtnListeners() {
        // Next and Prev Listener
        this.pagNavList.addEventListener(
            "click",
            this.handleNextPrev.bind(this),
            false,
        );

        // Numbered Listener
        this.qNumList.addEventListener(
            "click",
            this.handleNumberedNav.bind(this),
            false,
        );
    }

    // set up event for flag
    flagBtnListener() {
        this.flaggingPlace.addEventListener(
            "click",
            this.handleFlag.bind(this), // calls this to take action
            false,
        );
    }

    renderSubmitButton() {
        this.buttonContainer = document.createElement("div");
        this.buttonContainer.classList.add("timed-center");
        this.finishButton = document.createElement("button");
        this.finishButton.id = "finish";
        this.finishButton.setAttribute("class", "btn btn-primary");
        this.finishButton.textContent = "Finish Exam";
        this.finishButton.addEventListener(
            "click",
            async function () {
                let skipped = this.renderedQuestionArray.filter(
                    (x) => !x.question.isAnswered,
                ).length;
                let skipstr =
                    skipped > 0
                        ? `You have skipped ${skipped} question(s).`
                        : "";
                if (
                    window.confirm(
                        `${skipstr} Clicking OK means you are ready to submit your answers and are finished with this assessment.`,
                    )
                ) {
                    await this.finishAssessment();
                    this.flagButton.classList.add("timed-hidden");
                }
            }.bind(this),
            false,
        );
        this.controlDiv.appendChild(this.finishButton);
        this.finishButton.classList.add("timed-hidden");
        this.timedDiv.appendChild(this.buttonContainer);
    }
    ensureButtonSafety() {
        if (this.currentQuestionIndex === 0) {
            if (this.renderedQuestionArray.length != 1) {
                this.rightContainer.classList.remove("disabled");
            }
            this.leftContainer.classList.add("disabled");
        }
        if (
            this.currentQuestionIndex >=
            this.renderedQuestionArray.length - 1
        ) {
            if (this.renderedQuestionArray.length != 1) {
                this.leftContainer.classList.remove("disabled");
            }
            this.rightContainer.classList.add("disabled");
        }
        if (
            this.currentQuestionIndex > 0 &&
            this.currentQuestionIndex < this.renderedQuestionArray.length - 1
        ) {
            this.rightContainer.classList.remove("disabled");
            this.leftContainer.classList.remove("disabled");
        }
    }
    renderFeedbackContainer() {
        this.scoreDiv = document.createElement("P");
        if (this.taken) {
            this.scoreDiv.innerHTML =
                "<h2>You have already taken this exam</h2>";
            this.scoreDiv.classList.add("timed-visible");
        } else {
            this.scoreDiv.id = this.divid + "results";
            this.scoreDiv.classList.add("timed-hidden");
        }
        this.containerDiv.appendChild(this.scoreDiv);
    }

    createRenderedQuestionArray() {
        // this finds all the assess questions in this timed assessment
        // We need to make a list of all the questions up front so we can set up navigation
        // but we do not want to render the questions until the student has navigated
        // Also adds them to this.renderedQuestionArray

        // todo:  This needs to be updated to account for the runestone div wrapper.

        // To accommodate the selectquestion type -- which is async! we need to wrap
        // all of this in a promise, so that we don't continue to render the timed
        // exam until all of the questions have been realized.
        var opts;
        for (var i = 0; i < this.newChildren.length; i++) {
            var tmpChild = this.newChildren[i];
            opts = {
                state: "prepared",
                orig: tmpChild,
                question: {},
                useRunestoneServices: eBookConfig.useRunestoneServices,
                timed: true,
                assessmentTaken: this.taken,
                timedWrapper: this.divid,
                initAttempts: 0,
            };
            let componentChild = tmpChild.querySelector(
                ":scope > [data-component]",
            );
            if (componentChild) {
                tmpChild = componentChild;
                opts.orig = tmpChild;
            }
            if (tmpChild.matches("[data-component]")) {
                this.renderedQuestionArray.push(opts);
            }
        }
    }

    randomizeRQA() {
        var currentIndex = this.renderedQuestionArray.length,
            temporaryValue,
            randomIndex;
        // While there remain elements to shuffle...
        while (currentIndex !== 0) {
            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            // And swap it with the current element.
            temporaryValue = this.renderedQuestionArray[currentIndex];
            this.renderedQuestionArray[currentIndex] =
                this.renderedQuestionArray[randomIndex];
            this.renderedQuestionArray[randomIndex] = temporaryValue;
        }
    }

    async renderTimedQuestion() {
        if (this.currentQuestionIndex >= this.renderedQuestionArray.length) {
            // sometimes the user clicks in the event area for the qNumList
            // But misses a number in that case the text is the concatenation
            // of all the numbers in the list!
            return;
        }
        // check the renderedQuestionArray to see if it has been rendered.
        let opts = this.renderedQuestionArray[this.currentQuestionIndex];
        let currentQuestion;
        if (
            opts.state === "prepared" ||
            opts.state === "forreview" ||
            (opts.state === "broken_exam" && opts.initAttempts < 3)
        ) {
            let tmpChild = opts.orig;
            if (tmpChild && tmpChild.matches("[data-component=selectquestion]")) {
                if (this.done && opts.state == "prepared") {
                    this.renderedQuestionArray[
                        this.currentQuestionIndex
                    ].state = "exam_ended";
                } else {
                    // SelectOne is async and will replace itself in this array with
                    // the actual selected question
                    opts.rqa = this.renderedQuestionArray;
                    let newq = new SelectOne(opts);
                    this.renderedQuestionArray[this.currentQuestionIndex] = {
                        question: newq,
                    };
                    try {
                        await newq.initialize();
                        if (opts.state == "broken_exam") {
                            // remove the broken class from this question if we get here.
                            this.qNumItem(
                                this.currentQuestionIndex,
                            )?.classList.remove("broken");
                        }
                    } catch (e) {
                        opts.state = "broken_exam";
                        this.renderedQuestionArray[this.currentQuestionIndex] =
                            opts;
                        console.log(
                            `Error initializing question: Details ${e}`,
                        );
                    }
                }
            } else if (tmpChild && tmpChild.matches("[data-component]")) {
                let componentKind = tmpChild.dataset.component;
                this.renderedQuestionArray[this.currentQuestionIndex] = {
                    question: window.component_factory[componentKind](opts),
                    state: opts.state,
                };
            }
        } else if (opts.state === "broken_exam") {
            return;
        }

        currentQuestion =
            this.renderedQuestionArray[this.currentQuestionIndex].question;
        if (opts.state === "forreview") {
            await currentQuestion.component_ready_promise;
            await currentQuestion.checkCurrentAnswer();
            currentQuestion.renderFeedback();
            currentQuestion.disableInteraction();
        }

        if (!this.visited.includes(this.currentQuestionIndex)) {
            this.visited.push(this.currentQuestionIndex);
            if (
                this.visited.length === this.renderedQuestionArray.length &&
                !this.done
            ) {
                this.finishButton.classList.remove("timed-hidden");
            }
        }

        if (currentQuestion.containerDiv) {
            if (
                currentQuestion.containerDiv.classList.contains("runestone") ==
                false
            ) {
                currentQuestion.containerDiv.classList.add("runestone");
            }
            this.switchDiv.replaceWith(currentQuestion.containerDiv);
            this.switchDiv = currentQuestion.containerDiv;
        }

        // If the timed component has listeners, those might need to be reinitialized
        // This flag will only be set in the elements that need it--it will be undefined in the others and thus evaluate to false
        if (currentQuestion.needsReinitialization) {
            currentQuestion.reinitializeListeners(this.taken);
        }
    }

    /*=================================
    === Timer and control Functions ===
    =================================*/
    handlePrevAssessment() {
        this.startBtn.classList.add("timed-hidden");
        this.pauseBtn.disabled = true;
        this.finishButton.disabled = true;
        this.running = 0;
        this.done = 1;
        // showFeedback sand showResults should both be true before we show the
        // questions and their state of correctness.
        if (this.showResults && this.showFeedback) {
            this.timedDiv.classList.remove("timed-hidden");
            this.restoreAnsweredQuestions(); // do not log these results
        } else {
            this.pauseBtn.classList.add("timed-hidden");
            this.timerContainer.classList.add("timed-hidden");
        }
    }
    startAssessment() {
        if (!this.taken) {
            hideElement(document.getElementById("relations-next")); // hide the next page button for now
            hideElement(document.getElementById("relations-prev")); // hide the previous button for now
            this.startBtn.classList.add("timed-hidden");
            this.pauseBtn.disabled = false;
            if (this.running === 0 && this.paused === 0) {
                this.running = 1;
                this.lastTime = Date.now();
                this.timedDiv.classList.remove("timed-hidden");
                this.increment();
                this.logBookEvent({
                    event: "timedExam",
                    act: "start",
                    div_id: this.divid,
                });
                var timeStamp = new Date();
                var storageObj = {
                    answer: [0, 0, this.renderedQuestionArray.length, 0],
                    timestamp: timeStamp,
                };
                localStorage.setItem(
                    this.localStorageKey(),
                    JSON.stringify(storageObj),
                );
            }
            this.beforeUnloadHandler = function (event) {
                // this actual value gets ignored by newer browsers
                if (this.done) {
                    return;
                }
                event.preventDefault();
                event.returnValue =
                    "Are you sure you want to leave?  Your work will be lost! And you will need your instructor to reset the exam!";
                return "Are you sure you want to leave?  Your work will be lost!";
            }.bind(this);
            window.addEventListener("beforeunload", this.beforeUnloadHandler);
            window.addEventListener(
                "pagehide",
                async function (event) {
                    if (!this.done) {
                        await this.finishAssessment();
                        console.log("Exam exited by leaving page");
                    }
                }.bind(this),
            );
        } else {
            this.handlePrevAssessment();
        }
    }
    pauseAssessment() {
        if (this.done === 0) {
            if (this.running === 1) {
                this.logBookEvent({
                    event: "timedExam",
                    act: "pause",
                    div_id: this.divid,
                });
                this.running = 0;
                this.paused = 1;
                this.pauseBtn.innerHTML = "Resume";
                this.timedDiv.classList.add("timed-hidden");
            } else {
                this.logBookEvent({
                    event: "timedExam",
                    act: "resume",
                    div_id: this.divid,
                });
                this.running = 1;
                this.paused = 0;
                this.increment();
                this.pauseBtn.innerHTML = "Pause";
                this.timedDiv.classList.remove("timed-hidden");
            }
        }
    }

    showTime() {
        if (this.showTimer) {
            var mins = Math.floor(this.timeLimit / 60);
            var secs = Math.floor(this.timeLimit) % 60;
            var minsString = mins;
            var secsString = secs;
            if (mins < 10) {
                minsString = "0" + mins;
            }
            if (secs < 10) {
                secsString = "0" + secs;
            }
            var beginning = "Time Remaining    ";
            if (!this.limitedTime) {
                beginning = "Time Taken    ";
            }
            var timeString = beginning + minsString + ":" + secsString;
            if (this.done || this.taken) {
                var minutes = Math.floor(this.timeTaken / 60);
                var seconds = Math.floor(this.timeTaken % 60);
                if (minutes < 10) {
                    minutes = "0" + minutes;
                }
                if (seconds < 10) {
                    seconds = "0" + seconds;
                }
                timeString = "Time taken: " + minutes + ":" + seconds;
            }
            this.timerContainer.innerHTML = timeString;
            var timeTips = document.getElementsByClassName("timeTip");
            for (var i = 0; i <= timeTips.length - 1; i++) {
                timeTips[i].title = timeString;
            }
        } else {
            this.timerContainer.classList.add("timed-hidden");
        }
    }

    increment() {
        // if running (not paused) and not taken
        if (this.running === 1 && !this.taken) {
            setTimeout(
                function () {
                    // When a browser loses focus, setTimeout may not be called on the
                    // schedule expected.  Browsers are free to save power by lengthening
                    // the interval to some longer time.  So we cannot just subtract 1
                    // from the timeLimit we need to measure the elapsed time from the last
                    // call to the current call and subtract that number of seconds.
                    let currentTime = Date.now();
                    if (this.limitedTime) {
                        // If there's a time limit, count down to 0
                        this.timeLimit =
                            this.timeLimit -
                            Math.floor((currentTime - this.lastTime) / 1000);
                    } else {
                        // Else count up to keep track of how long it took to complete
                        this.timeLimit =
                            this.timeLimit +
                            Math.floor((currentTime - this.lastTime) / 1000);
                    }
                    this.lastTime = currentTime;
                    localStorage.setItem(
                        eBookConfig.email + ":" + this.divid + "-time",
                        this.timeLimit,
                    );
                    this.showTime();
                    if (this.timeLimit > 0) {
                        this.increment();
                        // ran out of time
                    } else {
                        this.startBtn.disabled = true;
                        this.finishButton.disabled = true;
                        this.running = 0;
                        this.done = 1;
                        if (!this.taken) {
                            this.taken = true;
                            // embed the message in the page -- an alert actually prevents
                            // the answers from being submitted and if a student closes their
                            // laptop then the answers will not be submitted ever!  Even when they
                            // reopen the laptop their session cookie is likely invalid.
                            let mess = document.createElement("h1");
                            mess.innerHTML =
                                "Sorry but you ran out of time. Your answers are being submitted";
                            this.controlDiv.appendChild(mess);
                            this.finishAssessment();
                        }
                    }
                }.bind(this),
                1000,
            );
        }
    }

    styleExamElements() {
        // Checks if this exam has been taken before
        this.timerContainer.classList.add("timed-summary-style");
        this.scoreDiv.classList.add("timed-summary-style");
        for (const tip of document.querySelectorAll(".tooltipTime")) {
            tip.classList.add("timed-tooltip-time");
        }
    }

    async finishAssessment() {
        showElement(document.getElementById("relations-next")); // show the next page button for now
        showElement(document.getElementById("relations-prev")); // show the previous button for now
        if (!this.showFeedback) {
            // bje - changed from showResults
            this.timedDiv.classList.add("timed-hidden");
            this.pauseBtn.classList.add("timed-hidden");
            this.timerContainer.classList.add("timed-hidden");
        }
        this.findTimeTaken();
        this.running = 0;
        this.done = 1;
        this.taken = 1;
        await this.finalizeProblems();
        this.checkScore();
        this.displayScore();
        this.storeScore();
        this.logScore();
        this.pauseBtn.disabled = true;
        this.finishButton.disabled = true;
        if (this.beforeUnloadHandler) {
            window.removeEventListener(
                "beforeunload",
                this.beforeUnloadHandler,
            );
        }
        // turn off the pagehide listener
        setTimeout(() => {
            this.submitAutograde();
        }, 2000);
    }

    async submitAutograde() {
        try {
            let response = await fetch("/assignment/student/autograde", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    assignment_id: this.divid,
                    is_timed: true,
                }),
            });
            let retdata = await response.json();
            if (retdata.success == false) {
                console.log(retdata.message);
            } else {
                console.log("Autograder completed");
            }
        } catch (err) {
            console.log(`Error submitting exam for autograding: ${err}`);
        }
    }

    // finalizeProblems
    // ----------------
    async finalizeProblems() {
        // Because we have submitted each question as we navigate we only need to
        // send the final version of the question the student is on when they press the
        // finish exam button.

        var currentQuestion =
            this.renderedQuestionArray[this.currentQuestionIndex].question;
        await currentQuestion.checkCurrentAnswer();
        await currentQuestion.logCurrentAnswer();
        currentQuestion.renderFeedback();
        currentQuestion.disableInteraction();

        for (var i = 0; i < this.renderedQuestionArray.length; i++) {
            let currentQuestion = this.renderedQuestionArray[i];
            // set the state to forreview so we know that feedback may be appropriate
            if (currentQuestion.state !== "broken_exam") {
                currentQuestion.state = "forreview";
                currentQuestion.question.disableInteraction();
            }
        }

        if (!this.showFeedback) {
            this.hideTimedFeedback();
        }
    }

    // restoreAnsweredQuestions
    // ------------------------
    restoreAnsweredQuestions() {
        for (var i = 0; i < this.renderedQuestionArray.length; i++) {
            var currentQuestion = this.renderedQuestionArray[i];
            if (currentQuestion.state === "prepared") {
                currentQuestion.state = "forreview";
            }
        }
    }

    // hideTimedFeedback
    // -----------------
    hideTimedFeedback() {
        for (var i = 0; i < this.renderedQuestionArray.length; i++) {
            var currentQuestion = this.renderedQuestionArray[i].question;
            currentQuestion.hideFeedback();
        }
    }

    // checkScore
    // ----------
    // This is a simple all or nothing score of one point per question for
    // that includes our best guess if a question was skipped.
    checkScore() {
        this.correctStr = "";
        this.skippedStr = "";
        this.incorrectStr = "";
        // Gets the score of each problem
        for (var i = 0; i < this.renderedQuestionArray.length; i++) {
            var correct =
                this.renderedQuestionArray[i].question.checkCorrectTimed();
            if (correct == "T") {
                this.score++;
                this.correctStr = this.correctStr + (i + 1) + ", ";
            } else if (correct == "F") {
                this.incorrect++;
                this.incorrectStr = this.incorrectStr + (i + 1) + ", ";
            } else if (correct === null || correct === "I") {
                this.skipped++;
                this.skippedStr = this.skippedStr + (i + 1) + ", ";
            } else {
                // ignored question; just do nothing
            }
        }
        // remove extra comma and space at end if any
        if (this.correctStr.length > 0)
            this.correctStr = this.correctStr.substring(
                0,
                this.correctStr.length - 2,
            );
        else this.correctStr = "None";
        if (this.skippedStr.length > 0)
            this.skippedStr = this.skippedStr.substring(
                0,
                this.skippedStr.length - 2,
            );
        else this.skippedStr = "None";
        if (this.incorrectStr.length > 0)
            this.incorrectStr = this.incorrectStr.substring(
                0,
                this.incorrectStr.length - 2,
            );
        else this.incorrectStr = "None";
    }
    findTimeTaken() {
        if (this.limitedTime) {
            this.timeTaken = this.startingTime - this.timeLimit;
        } else {
            this.timeTaken = this.timeLimit;
        }
    }
    storeScore() {
        var storage_arr = [];
        storage_arr.push(
            this.score,
            this.correctStr,
            this.incorrect,
            this.incorrectStr,
            this.skipped,
            this.skippedStr,
            this.timeTaken,
        );
        var timeStamp = new Date();
        var storageObj = JSON.stringify({
            answer: storage_arr,
            timestamp: timeStamp,
        });
        localStorage.setItem(this.localStorageKey(), storageObj);
    }
    // _`timed exam endpoint parameters`
    //----------------------------------
    logScore() {
        this.logBookEvent({
            event: "timedExam",
            act: "finish",
            div_id: this.divid,
            correct: this.score,
            incorrect: this.incorrect,
            skipped: this.skipped,
            time_taken: this.timeTaken,
        });
    }
    shouldUseServer(data) {
        // We override the RunestoneBase version because there is no "correct" attribute, and there are 2 possible localStorage schemas
        // --we also want to default to local storage because it contains more information specifically which questions are correct, incorrect, and skipped.
        var storageDate;
        if (localStorage.length === 0) return true;
        var storageObj = localStorage.getItem(this.localStorageKey());
        if (storageObj === null) return true;
        try {
            var storedData = JSON.parse(storageObj).answer;
            if (storedData.length == 4) {
                if (
                    data.correct == storedData[0] &&
                    data.incorrect == storedData[1] &&
                    data.skipped == storedData[2] &&
                    data.timeTaken == storedData[3]
                )
                    return true;
            } else if (storedData.length == 7) {
                if (
                    data.correct == storedData[0] &&
                    data.incorrect == storedData[2] &&
                    data.skipped == storedData[4] &&
                    data.timeTaken == storedData[6]
                ) {
                    return false; // In this case, because local storage has more info, we want to use that if it's consistent
                }
            }
            storageDate = new Date(JSON.parse(storageObj[1]).timestamp);
        } catch (err) {
            // error while parsing; likely due to bad value stored in storage
            console.log(err.message);
            localStorage.removeItem(this.localStorageKey());
            return true;
        }
        var serverDate = new Date(data.timestamp);
        if (serverDate < storageDate) {
            this.logScore();
            return false;
        }
        return true;
    }

    checkLocalStorage() {
        var len = localStorage.length;
        if (len > 0) {
            if (localStorage.getItem(this.localStorageKey()) !== null) {
                this.taken = 1;
                this.restoreAnswers("");
            } else {
                this.taken = 0;
            }
        } else {
            this.taken = 0;
        }
    }
    async restoreAnswers(data) {
        this.taken = 1;
        var tmpArr;
        if (data === "") {
            let error = false;
            let storageObj;
            try {
                storageObj = JSON.parse(
                    localStorage.getItem(this.localStorageKey()),
                );
                tmpArr = storageObj.answer;
            } catch (err) {
                // error while parsing; likely due to bad value stored in storage
                console.log(
                    `Error parsing stored Timed data for ${this.divid}: ${err.message}`,
                );
                error = true;
            }
            if (error || storageObj.timestamp < eBookConfig.termStartDate) {
                localStorage.removeItem(this.localStorageKey());
                this.taken = 0;
                return;
            }
        } else {
            // Parse results from the database
            tmpArr = [
                parseInt(data.correct),
                parseInt(data.incorrect),
                parseInt(data.skipped),
                parseInt(data.time_taken),
                data.reset,
            ];
            this.setLocalStorage(tmpArr);
        }
        if (tmpArr.length == 1) {
            // Exam was previously reset
            this.reset = true;
            this.taken = 0;
            return;
        }
        if (tmpArr.length == 4) {
            // Accidental Reload OR Database Entry
            this.score = tmpArr[0];
            this.incorrect = tmpArr[1];
            this.skipped = tmpArr[2];
            this.timeTaken = tmpArr[3];
        } else if (tmpArr.length == 5) {
            this.score = tmpArr[0];
            this.incorrect = tmpArr[1];
            this.skipped = tmpArr[2];
            this.timeTaken = tmpArr[3];
        } else if (tmpArr.length == 7) {
            // Loaded Completed Exam
            this.score = tmpArr[0];
            this.correctStr = tmpArr[1];
            this.incorrect = tmpArr[2];
            this.incorrectStr = tmpArr[3];
            this.skipped = tmpArr[4];
            this.skippedStr = tmpArr[5];
            this.timeTaken = tmpArr[6];
        } else {
            // Set localStorage in case of "accidental" reload
            this.score = 0;
            this.incorrect = 0;
            this.skipped = this.renderedQuestionArray.length;
            this.timeTaken = 0;
        }
        if (this.taken) {
            if (this.skipped === this.renderedQuestionArray.length) {
                this.showFeedback = false;
            }
            this.handlePrevAssessment();
        }
        await this.renderTimedQuestion();
        this.displayScore();
        this.showTime();
    }
    setLocalStorage(parsedData) {
        var timeStamp = new Date();
        var storageObj = {
            answer: parsedData,
            timestamp: timeStamp,
        };
        localStorage.setItem(
            this.localStorageKey(),
            JSON.stringify(storageObj),
        );
    }
    displayScore() {
        // Reveal the score, clearing the initial hidden state so the element
        // isn't left with both timed-hidden and timed-visible (which only
        // works by CSS source order).
        this.scoreDiv.classList.remove("timed-hidden");
        if (this.showResults) {
            var scoreString = "";
            var numQuestions;
            var percentCorrect;
            // if we have some information
            if (
                this.correctStr.length > 0 ||
                this.incorrectStr.length > 0 ||
                this.skippedStr.length > 0
            ) {
                scoreString = `Num Correct: ${this.score}. Questions: ${this.correctStr}<br>Num Wrong: ${this.incorrect}. Questions: ${this.incorrectStr}<br>Num Skipped: ${this.skipped}. Questions: ${this.skippedStr}<br>`;
                numQuestions = this.score + this.incorrect + this.skipped;
                percentCorrect = (this.score / numQuestions) * 100;
                scoreString +=
                    "Percent Correct: " + percentCorrect.toFixed(2) + "%";
                this.scoreDiv.innerHTML = scoreString;
                this.scoreDiv.classList.add("timed-visible");
            } else {
                scoreString = `Num Correct: ${this.score}<br>Num Wrong: ${this.incorrect}<br>Num Skipped: ${this.skipped}<br>`;
                numQuestions = this.score + this.incorrect + this.skipped;
                percentCorrect = (this.score / numQuestions) * 100;
                scoreString +=
                    "Percent Correct: " + percentCorrect.toFixed(2) + "%";
                this.scoreDiv.innerHTML = scoreString;
                this.scoreDiv.classList.add("timed-visible");
            }
            this.highlightNumberedList();
        } else {
            this.scoreDiv.innerHTML =
                "Thank you for taking the exam.  Your answers have been recorded.";
            this.scoreDiv.classList.add("timed-visible");
        }
    }
    highlightNumberedList() {
        var correctCount = this.correctStr;
        var incorrectCount = this.incorrectStr;
        var skippedCount = this.skippedStr;
        correctCount = correctCount.replace(/ /g, "").split(",");
        incorrectCount = incorrectCount.replace(/ /g, "").split(",");
        skippedCount = skippedCount.replace(/ /g, "").split(",");
        var numberedBtns = document.querySelectorAll("ul#pageNums > ul > li");
        for (const btn of numberedBtns) {
            btn.classList.remove("answered");
        }
        // entries may be "None", whose index parses to NaN and marks nothing
        const mark = (entries, cls) => {
            for (const entry of entries) {
                const btn = numberedBtns[parseInt(entry) - 1];
                if (btn) {
                    btn.classList.add(cls);
                }
            }
        };
        mark(correctCount, "correctCount");
        mark(incorrectCount, "incorrectCount");
        mark(skippedCount, "skippedCount");
    }
}

// Page-level elements that may not exist on every page.
function hideElement(element) {
    if (element) {
        element.classList.add("timed-hidden");
    }
}

function showElement(element) {
    if (element) {
        element.classList.remove("timed-hidden");
    }
}

/*=======================================================
=== Function that calls the constructors on page load ===
=======================================================*/
document.addEventListener("runestone:login-complete", function () {
    for (let element of document.querySelectorAll(
        "[data-component=timedAssessment]",
    )) {
        window.componentMap[element.id] = new Timed({
            orig: element,
            useRunestoneServices: eBookConfig.useRunestoneServices,
        });
    }
});
