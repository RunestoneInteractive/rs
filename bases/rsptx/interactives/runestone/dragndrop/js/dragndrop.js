/*==========================================
=======     Master dragndrop.js     ========
============================================
===     This file contains the JS for    ===
=== the Runestone Drag n drop component. ===
============================================
===              Created by              ===
===           Isaiah Mayerchak           ===
===                7/6/15                ===
===              Brad MIller             ===
===                2/7/19                ===
==========================================*/
"use strict";

import RunestoneBase from "../../common/js/runestonebase.js";
import "../css/dragndrop.less";
import "./dragndrop-i18n.en.js";
import "./dragndrop-i18n.pt-br.js";
//import "./DragDropTouch.js";

export default class DragNDrop extends RunestoneBase {
    constructor(opts) {
        super(opts);
        var orig = opts.orig; // entire <ul> element that will be replaced by new HTML
        this.origElem = orig;
        this.divid = orig.id;
        this.useRunestoneServices = opts.useRunestoneServices;
        this.random = false;
        if ($(this.origElem).is("[data-random]")) {
            this.random = true;
        }
        this.feedback = "";
        this.question = "";
        this.populate(); // Populates this.dropArray, this.dragArray, this.feedback and this.question
        this.createNewElements();
        this.caption = "Drag-N-Drop";
        this.addCaption("runestone");
        if (typeof Prism !== "undefined") {
            Prism.highlightAllUnder(this.containerDiv);
        }
    }

    /*======================
    === Update variables ===
    ======================*/
    populate() {
        this.dropArray = [];
        this.dragArray = [];
        for (let element of this.origElem.querySelectorAll(
            "[data-subcomponent='draggable']"
        )) {
            let replaceSpan = document.createElement("span");
            replaceSpan.innerHTML = element.innerHTML;
            replaceSpan.id = element.id;
            replaceSpan.setAttribute("draggable", "true");
            replaceSpan.classList.add("draggable-drag");
            replaceSpan.classList.add("premise");
            replaceSpan.dataset.category = this.getCategory(element);
            replaceSpan.dataset.parent_id = this.divid;
            this.dragArray.push(replaceSpan);
            this.setDragListeners(replaceSpan);
        }
        this.dragArray = shuffleArray(this.dragArray);
        for (let element of this.origElem.querySelectorAll(
            "[data-subcomponent='dropzone']"
        )) {
            let replaceSpan = document.createElement("span");
            replaceSpan.innerHTML = element.innerHTML;
            replaceSpan.id = element
                .getAttribute("for")
                .replace("drag", "drop");
            replaceSpan.classList.add(
                "draggable-drop",
                "drop-label",
                "response"
            );
            replaceSpan.dataset.category = this.getCategory(element);
            replaceSpan.dataset.parent_id = this.divid;
            this.dropArray.push(replaceSpan);
            this.setDropListeners(replaceSpan);
        }

        this.question = this.origElem.querySelector(
            "[data-subcomponent='question']"
        ).innerHTML;
        this.feedback = this.origElem.querySelector(
            "[data-subcomponent='feedback']"
        ).innerHTML;
    }

    getCategory(elem) {
        if (elem.dataset.category) {
            return elem.dataset.category;
        } else {
            // if no category then use the for attribute or the id
            // this is for backwards compatibility
            if (elem.hasAttribute("for")) {
                return elem.getAttribute("for");
            } else {
                return elem.id;
            }
        }
    }
    /*========================================
    == Create new HTML elements and replace ==
    ==      original element with them      ==
    ========================================*/
    createNewElements() {
        this.containerDiv = document.createElement("div");
        this.containerDiv.id = this.divid;
        this.containerDiv.classList.add("draggable-container");
        this.containerDiv.innerHTML = this.question;
        this.containerDiv.appendChild(document.createElement("br"));
        this.dragDropWrapDiv = document.createElement("div"); // Holds the draggables/dropzones, prevents feedback from bleeding in
        this.dragDropWrapDiv.style.display = "block";
        this.containerDiv.appendChild(this.dragDropWrapDiv);
        this.draggableDiv = document.createElement("div");
        this.draggableDiv.classList.add("rsdraggable", "dragzone");
        this.addDragDivListeners();
        this.dropZoneDiv = document.createElement("div");
        this.dropZoneDiv.classList.add("rsdraggable");
        this.dragDropWrapDiv.appendChild(this.draggableDiv);
        this.dragDropWrapDiv.appendChild(this.dropZoneDiv);
        this.createButtons();
        this.checkServer("dragNdrop", true);
        if (eBookConfig.practice_mode) {
            this.finishSettingUp();
        }
        self = this;
        self.queueMathJax(self.containerDiv);
    }

    finishSettingUp() {
        this.appendReplacementSpans();
        this.createFeedbackDiv();
        this.origElem.parentNode.replaceChild(this.containerDiv, this.origElem);
        if (!this.hasStoredDropzones) {
            this.minheight = this.draggableDiv.offsetHeight;
        }
        this.draggableDiv.style.minHeight = this.minheight.toString() + "px";
        if (this.dropZoneDiv.offsetHeight > this.minheight) {
            this.dragDropWrapDiv.style.minHeight =
                this.dropZoneDiv.offsetHeight.toString() + "px";
        } else {
            this.dragDropWrapDiv.style.minHeight =
                this.minheight.toString() + "px";
        }
    }
    addDragDivListeners() {
        let self = this;
        this.draggableDiv.addEventListener(
            "dragover",
            function (ev) {
                ev.preventDefault();
                if (this.draggableDiv.classList.contains("possibleDrop")) {
                    return;
                }
                this.draggableDiv.classList.add("possibleDrop");
            }.bind(this)
        );
        this.draggableDiv.addEventListener(
            "drop",
            function (ev) {
                self.isAnswered = true;
                ev.preventDefault();
                if (this.draggableDiv.classList.contains("possibleDrop")) {
                    this.draggableDiv.classList.remove("possibleDrop");
                }
                var data = ev.dataTransfer.getData("draggableID");
                var draggedSpan = document.getElementById(data);
                if (
                    !this.draggableDiv.contains(draggedSpan) &&
                    !this.strangerDanger(draggedSpan)
                ) {
                    // Make sure element isn't already there--prevents erros w/appending child
                    this.draggableDiv.appendChild(draggedSpan);
                }
            }.bind(this)
        );
        this.draggableDiv.addEventListener(
            "dragleave",
            function (e) {
                if (!this.draggableDiv.classList.contains("possibleDrop")) {
                    return;
                }
                this.draggableDiv.classList.remove("possibleDrop");
            }.bind(this)
        );
    }
    createButtons() {
        this.buttonDiv = document.createElement("div");
        this.submitButton = document.createElement("button"); // Check me button
        this.submitButton.textContent = $.i18n("msg_dragndrop_check_me");
        $(this.submitButton).attr({
            class: "btn btn-success drag-button",
            name: "do answer",
            type: "button",
        });
        this.submitButton.onclick = function () {
            this.checkCurrentAnswer();
            this.renderFeedback();
            this.logCurrentAnswer();
        }.bind(this);
        this.resetButton = document.createElement("button"); // Check me button
        this.resetButton.textContent = $.i18n("msg_dragndrop_reset");
        $(this.resetButton).attr({
            class: "btn btn-default drag-button drag-reset",
            name: "do answer",
        });
        this.resetButton.onclick = function () {
            this.resetDraggables();
        }.bind(this);
        this.buttonDiv.appendChild(this.submitButton);
        this.buttonDiv.appendChild(this.resetButton);
        this.containerDiv.appendChild(this.buttonDiv);
    }
    appendReplacementSpans() {
        // todo - there may be stored drops that we need to handle
        // if answerState is empty
        if (
            this.answerState === undefined ||
            Object.keys(this.answerState).length === 0
        ) {
            this.answerState = {};
            for (let element of this.dragArray) {
                this.draggableDiv.appendChild(element);
            }
            for (let element of this.dropArray) {
                this.dropZoneDiv.appendChild(element);
            }
        } else {
            let placedPremises = [];
            for (let response of this.dropArray) {
                this.dropZoneDiv.appendChild(response);
                if (this.answerState[response.id]) {
                    for (let premise of this.answerState[response.id]) {
                        placedPremises.push(premise);
                        response.appendChild(this.findPremise(premise));
                    }
                }
            }
            for (let premise of this.dragArray) {
                if (placedPremises.indexOf(premise.id) == -1) {
                    this.draggableDiv.appendChild(premise);
                }
            }
        }
    }

    findPremise(id) {
        for (let premise of this.dragArray) {
            if (premise.id == id) {
                return premise;
            }
        }
    }

    setDragListeners(dgSpan) {
        let self = this;
        dgSpan.addEventListener("dragstart", function (ev) {
            ev.dataTransfer.setData("draggableID", ev.target.id);
        });
        dgSpan.addEventListener("dragover", function (ev) {
            ev.preventDefault();
        });
        dgSpan.addEventListener(
            "drop",
            function (ev) {
                self.isAnswered = true;
                ev.preventDefault();
                var data = ev.dataTransfer.getData("draggableID");
                var draggedSpan = document.getElementById(data);
                if (
                    draggedSpan != ev.target &&
                    !this.strangerDanger(draggedSpan)
                ) {
                    // Make sure element isn't already there--prevents erros w/appending child
                    this.draggableDiv.appendChild(draggedSpan);
                }
            }.bind(this)
        );
    }

    setDropListeners(dpSpan) {
        dpSpan.addEventListener(
            "dragover",
            function (ev) {
                self.isAnswered = true;
                ev.preventDefault();
                if ($(ev.target).hasClass("possibleDrop")) {
                    return;
                }
                if ($(ev.target).hasClass("draggable-drop")) {
                    $(ev.target).addClass("possibleDrop");
                }
            }.bind(this)
        );
        dpSpan.addEventListener("dragleave", function (ev) {
            self.isAnswered = true;
            ev.preventDefault();
            if (!$(ev.target).hasClass("possibleDrop")) {
                return;
            }
            $(ev.target).removeClass("possibleDrop");
        });
        dpSpan.addEventListener(
            "drop",
            function (ev) {
                self.isAnswered = true;
                ev.preventDefault();
                if ($(ev.target).hasClass("possibleDrop")) {
                    $(ev.target).removeClass("possibleDrop");
                }
                var data = ev.dataTransfer.getData("draggableID");
                var draggedSpan = document.getElementById(data);
                if (
                    $(ev.target).hasClass("draggable-drop") &&
                    !this.strangerDanger(draggedSpan) &&
                    !this.dragArray.includes(ev.target) // don't drop on another premise!
                ) {
                    // Make sure element isn't already there--prevents erros w/appending child
                    ev.target.appendChild(draggedSpan);
                }
            }.bind(this)
        );
    }

    createFeedbackDiv() {
        if (!this.feedBackDiv) {
            this.feedBackDiv = document.createElement("div");
            this.feedBackDiv.id = this.divid + "_feedback";
            this.containerDiv.appendChild(document.createElement("br"));
            this.containerDiv.appendChild(this.feedBackDiv);
        }
    }
    /*=======================
    == Auxiliary functions ==
    =======================*/
    /* leaving the name as is, because it reminds me of Isaiah! */
    strangerDanger(testSpan) {
        // Returns true if the test span doesn't belong to this instance of DragNDrop
        if (testSpan.dataset.parent_id != this.divid) {
            return true;
        } else {
            return false;
        }
    }
    /*==============================
    == Reset button functionality ==
    ==============================*/
    resetDraggables() {
        let resetList = [];
        for (let response of this.dropZoneDiv.childNodes) {
            response.classList.remove("drop-incorrect");
            for (let premise of response.childNodes) {
                if (
                    premise.nodeType !== Node.TEXT_NODE &&
                    this.dragArray.includes(premise)
                ) {
                    resetList.push([response, premise]); // array of [response, premise];
                }
            }
        }
        for (let i = 0; i < resetList.length; i++) {
            let response = resetList[i][0];
            let premise = resetList[i][1];
            premise.draggable = true;
            response.removeChild(premise);
            this.draggableDiv.appendChild(premise);
        }

        this.answerState = {};
        this.feedBackDiv.style.display = "none";
    }
    /*===========================
    == Evaluation and feedback ==
    ===========================*/
    getAllCategories() {
        this.categories = [];
        for (let response of this.dropZoneDiv.childNodes) {
            this.categories.push(response.dataset.category);
        }
        return this.categories;
    }

    checkCurrentAnswer() {
        let categories = this.getAllCategories();
        this.correct = true;
        this.unansweredNum = 0;
        this.incorrectNum = 0;
        this.correctNum = 0;
        this.dragNum = this.dragArray.length;
        let ivp = this.isValidPremis.bind(this);
        for (let response of this.dropZoneDiv.childNodes) {
            for (let premise of Array.from(response.childNodes).filter(ivp)) {
                if (premise.dataset.category == response.dataset.category) {
                    this.correctNum++;
                } else {
                    this.incorrectNum++;
                }
            }
        }
        for (let premise of Array.from(this.draggableDiv.childNodes).filter(
            (node) => node.nodeType !== Node.TEXT_NODE
        )) {
            if (categories.indexOf(premise.dataset.category) == -1) {
                this.correctNum++;
            } else {
                this.unansweredNum++;
            }
        }
        this.percent = this.correctNum / this.dragArray.length;
        console.log(this.percent, this.incorrectNum, this.unansweredNum);
        if (this.percent < 1.0) {
            this.correct = false;
        }
        this.setLocalStorage({ correct: this.correct ? "T" : "F" });
    }

    isCorrectDrop(response) {
        let correct = true;
        let correctPlacements = 0;
        for (let premise of Array.from(response.childNodes).filter(
            (node) => node.nodeType !== Node.TEXT_NODE
        )) {
            if (this.dragArray.indexOf(premise) !== -1) {
                if (premise.dataset.category != response.dataset.category) {
                    correct = false;
                } else {
                    correctPlacements++;
                }
            }
        }
        let catCount = 0;
        for (let premis of this.dragArray) {
            if (premis.dataset.category == response.dataset.category) {
                catCount++;
            }
        }
        return correct && correctPlacements == catCount;
    }

    isValidPremis(premise) {
        if (this.dragArray.includes(premise)) {
            return true;
        } else {
            return false;
        }
    }

    async logCurrentAnswer(sid) {
        let answer = JSON.stringify(this.answerState);
        let data = {
            event: "dragNdrop",
            act: answer,
            answer: answer,
            min_height: Math.round(this.minheight),
            div_id: this.divid,
            correct: this.correct,
            correctNum: this.correctNum,
            dragNum: this.dragNum,
        };
        if (typeof sid !== "undefined") {
            data.sid = sid;
        }
        await this.logBookEvent(data);
    }
    renderFeedback() {
        for (let response of this.dropZoneDiv.childNodes) {
            if (this.isCorrectDrop(response)) {
                response.classList.remove("drop-incorrect");
            } else {
                response.classList.add("drop-incorrect");
            }
        }
        if (!this.feedBackDiv) {
            this.createFeedbackDiv();
        }
        this.feedBackDiv.style.display = "block";
        if (this.correct) {
            var msgCorrect = $.i18n("msg_dragndrop_correct_answer");
            $(this.feedBackDiv).html(msgCorrect);
            $(this.feedBackDiv).attr(
                "class",
                "alert alert-info draggable-feedback"
            );
        } else {
            var msgIncorrect = $.i18n(
                $.i18n("msg_dragndrop_incorrect_answer"),
                this.correctNum,
                this.incorrectNum,
                this.dragNum,
                this.unansweredNum
            );
            // this.feedback comes from the author (a hint maybe)
            $(this.feedBackDiv).html(msgIncorrect + " " + this.feedback);
            $(this.feedBackDiv).attr(
                "class",
                "alert alert-danger draggable-feedback"
            );
        }
    }
    /*===================================
    === Checking/restoring from storage ===
    ===================================*/
    restoreAnswers(data) {
        // Restore answers from storage retrieval done in RunestoneBase
        this.hasStoredDropzones = true;
        this.minheight = data.min_height;
        this.answerState = JSON.parse(data.answer);
        this.finishSettingUp();
    }

    checkLocalStorage() {
        if (this.graderactive) {
            return;
        }
        var storedObj;
        this.hasStoredDropzones = false;
        var len = localStorage.length;
        if (len > 0) {
            var ex = localStorage.getItem(this.localStorageKey());
            if (ex !== null) {
                this.hasStoredDropzones = true;
                try {
                    storedObj = JSON.parse(ex);
                    this.minheight = storedObj.min_height;
                } catch (err) {
                    // error while parsing; likely due to bad value stored in storage
                    console.log(err.message);
                    localStorage.removeItem(this.localStorageKey());
                    this.hasStoredDropzones = false;
                    this.finishSettingUp();
                    return;
                }
                this.answerState = storedObj.answer;
                if (this.useRunestoneServices) {
                    // store answer in database
                    let answer = JSON.stringify(this.answerState);
                    this.logBookEvent({
                        event: "dragNdrop",
                        act: answer,
                        answer: answer,
                        min_height: Math.round(this.minheight),
                        div_id: this.divid,
                        correct: storedObj.correct,
                    });
                }
            }
        }
        this.finishSettingUp();
    }

    setLocalStorage(data) {
        if (data.answer === undefined) {
            // If we didn't load from the server, we must generate the data
            this.answerState = {};
            for (let response of this.dropZoneDiv.childNodes) {
                this.answerState[response.id] = [];
                for (let premise of response.childNodes) {
                    if (
                        premise.nodeType !== Node.TEXT_NODE &&
                        this.dragArray.includes(premise)
                    ) {
                        this.answerState[response.id].push(premise.id);
                    }
                }
            }
        }
        var timeStamp = new Date();
        var correct = data.correct;
        var storageObj = {
            answer: this.answerState,
            min_height: this.minheight,
            timestamp: timeStamp,
            correct: correct,
        };
        localStorage.setItem(
            this.localStorageKey(),
            JSON.stringify(storageObj)
        );
    }

    disableInteraction() {
        $(this.resetButton).hide();
        for (var i = 0; i < this.dragArray.length; i++) {
            // No more dragging
            this.dragArray[i].draggable = false;
            this.dragArray[i].style.cursor = "initial";
        }
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        // Generate a random index between 0 and i
        const j = Math.floor(Math.random() * (i + 1));
        // Swap elements at indices i and j
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/*=================================
== Find the custom HTML tags and ==
==   execute our code on them    ==
=================================*/
$(document).on("runestone:login-complete", function () {
    $("[data-component=dragndrop]").each(function (index) {
        var opts = {
            orig: this,
            useRunestoneServices: eBookConfig.useRunestoneServices,
        };
        if ($(this).closest("[data-component=timedAssessment]").length == 0) {
            // If this element exists within a timed component, don't render it here
            try {
                window.componentMap[this.id] = new DragNDrop(opts);
            } catch (err) {
                console.log(
                    `Error rendering DragNDrop Problem ${this.id}: ${err}`
                );
            }
        }
    });
});
