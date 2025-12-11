/*
__author__ = Kirby Olson
__date__ = 6/12/2015  */
"use strict";

import RunestoneBase from "../../common/js/runestonebase.js";
import "../css/poll.css";


export default class Poll extends RunestoneBase {
    constructor(opts) {
        super(opts);
        var orig = opts.orig; //entire <p> element
        this.origElem = orig;
        this.divid = orig.id;
        this.children = this.origElem.childNodes;
        this.optionList = [];
        this.optsArray = [];
        this.comment = false;
        if (this.origElem.hasAttribute("data-comment")) {
            this.comment = true;
        }
        this.resultsViewer = this.origElem.getAttribute("data-results");
        this.getQuestionText();
        this.getOptionText(); //populates optionList
        this.renderPoll(); //generates HTML
        // Checks localStorage to see if this poll has already been completed by this user.
        this.checkPollStorage();
        this.caption = "Poll";
        this.addCaption("runestone");
    }
    getQuestionText() {
        //finds the text inside the parent tag, but before the first <li> tag and sets it as the question
        var _this = this;
        var firstAnswer;
        for (var i = 0; i < this.children.length; i++) {
            if (this.children[i].tagName == "LI") {
                firstAnswer = _this.children[i];
                break;
            }
        }
        var delimiter = firstAnswer.outerHTML;
        var fulltext = this.origElem.innerHTML;
        var temp = fulltext.split(delimiter);
        this.question = temp[0];
    }
    getOptionText() {
        //Gets the text from each <li> tag and places it in this.optionList
        var _this = this;
        for (var i = 0; i < this.children.length; i++) {
            if (_this.children[i].tagName == "LI") {
                _this.optionList.push(_this.children[i].innerHTML);
            }
        }
    }
    renderPoll() {
        //generates the HTML that the user interacts with
        var _this = this;
        this.containerDiv = document.createElement("div");
        this.pollForm = document.createElement("form");
        this.resultsDiv = document.createElement("div");
        this.resultsDiv.classList.add("poll-results");
        this.containerDiv.id = this.divid;
        const origClass = this.origElem.getAttribute("class");
        if (origClass) {
            this.containerDiv.classList.add(...origClass.split(" ").filter(Boolean));
        }
        this.pollForm.innerHTML = `<div class="exercise-statement">${this.question}</div>`;
        this.pollForm.id = this.divid + "_form";
        this.pollForm.method = "get";
        this.pollForm.action = "";
        this.pollForm.onsubmit = function () { return false; };
        this.pollFieldset = document.createElement("fieldset");
        this.pollForm.appendChild(this.pollFieldset);
        for (var i = 0; i < this.optionList.length; i++) {
            let label = document.createElement("label");
            label.classList.add("poll-option");
            label.innerHTML += this.optionList[i]; // text content
            var radio = document.createElement("input");
            var tmpid = _this.divid + "_opt_" + i;
            radio.id = tmpid;
            radio.name = this.divid + "_group1";
            radio.type = "radio";
            radio.value = i;
            radio.classList.add("poll-choice-input");
            radio.addEventListener("click", this.submitPoll.bind(this));
            label.prepend(radio);
            this.pollFieldset.appendChild(label);
            this.optsArray.push(radio);
        }

        if (this.comment) {
            this.renderTextField();
        }
        this.resultsDiv.id = this.divid + "_results";
        this.containerDiv.appendChild(this.pollForm);
        this.containerDiv.appendChild(this.resultsDiv);
        this.origElem.replaceWith(this.containerDiv);
        this.queueMathJax(this.containerDiv);
    }
    renderTextField() {
        this.textfield = document.createElement("input");
        this.textfield.type = "text";
        this.textfield.classList.add("form-control");
        this.textfield.style.width = "300px";
        this.textfield.name = this.divid + "_comment";
        this.textfield.placeholder = "Any comments?";
        this.pollForm.appendChild(this.textfield);
        this.pollForm.appendChild(document.createElement("br"));
    }
    async submitPoll() {
        //checks the poll, sets localstorage and submits to the server
        var poll_val = null;
        for (var i = 0; i < this.optsArray.length; i++) {
            if (this.optsArray[i].checked) {
                poll_val = this.optsArray[i].value;
                break;
            }
        }
        if (poll_val === null) return;
        var comment_val = "";
        if (this.comment) {
            comment_val = this.textfield.value;
        }
        var act = "";
        if (comment_val !== "") {
            act = poll_val + ":" + comment_val;
        } else {
            act = poll_val;
        }
        var eventInfo = { event: "poll", act: act, div_id: this.divid };
        // log the response to the database
        this.logBookEvent(eventInfo); // in bookfuncs.js
        // log the fact that the user has answered the poll to local storage
        let onlineResponse = "Thanks, your response has been recorded";
        let offlineResponse = "Thanks, your answers are not recorded";
        let onlineUpdate = "Only Your last reponse is recorded";
        let offlineUpdate = "Thanks, your answers are not recorded";
        localStorage.setItem(this.divid, "true");
        if (!document.getElementById(`${this.divid}_sent`)) {
            const span = document.createElement("span");
            span.id = `${this.divid}_sent`;
            span.innerHTML = `<strong>${eBookConfig.useRunestoneServices ? onlineResponse : offlineResponse}</strong>`;
            this.pollForm.appendChild(span);
        } else {
            const sentEl = document.getElementById(`${this.divid}_sent`);
            sentEl.innerHTML = `<strong>${eBookConfig.useRunestoneServices ? onlineUpdate : offlineUpdate}</strong>`;
        }
        // show the results of the poll
        if (this.resultsViewer === "all") {
            var data = {};
            data.div_id = this.divid;
            data.course = eBookConfig.course;
            try {
                const params = new URLSearchParams(data);
                const resp = await fetch(`${eBookConfig.new_server_prefix}/assessment/getpollresults?${params.toString()}`);
                const json = await resp.json();
                this.showPollResults(json);
            } catch (e) {
                this.indicate_component_ready();
            }
        }
    }
    showPollResults(results) {
        //displays the results returned by the server
        results = results.detail;
        var total = results["total"];
        var optCounts = results["opt_counts"];
        var div_id = results["div_id"];
        var my_vote = results["my_vote"];
        // restore current users vote
        if (my_vote > -1) {
            this.optsArray[my_vote].checked = true;
        }
        // show results summary if appropriate
        if (
            (this.resultsViewer === "all" &&
                localStorage.getItem(this.divid) === "true") ||
            eBookConfig.isInstructor
        ) {
            this.resultsDiv.innerHTML = `<b>Results:</b> ${total} responses <br><br>`;
            var list = document.createElement("div");
            list.classList.add("results-container");
            for (var i = 0; i < this.optionList.length; i++) {
                var count;
                var percent;
                if (optCounts[i] > 0) {
                    count = optCounts[i];
                    percent = (count / total) * 100;
                } else {
                    count = 0;
                    percent = 0;
                }
                var text = count + " (" + Math.round(10 * percent) / 10 + "%)"; // round percent to 10ths
                let progressCounterEl = document.createElement("div");
                progressCounterEl.className = "progresscounter";
                progressCounterEl.innerText = `${i + 1}. `;
                let progressBarEl = document.createElement("div");
                let progressBarHTML = "";
                if (percent > 10) {
                    progressBarHTML =
                        "<div class='progress'>" +
                        "<div class='progress-bar progress-bar-success'" +
                        `style="width: ${percent}%; min-width: 2em;">` +
                        "<span class='poll-text'>" +
                        text +
                        "</span></div></div>";
                } else {
                    progressBarHTML =
                        "<div class='progress'>" +
                        "<div class='progress-bar progress-bar-success'" +
                        `style="width: ${percent}%; min-width: 2em;"></div>` +
                        "<span class='poll-text' style='margin: 0 0 0 10px;'>" +
                        text +
                        "</span></div>";
                }
                progressBarEl.innerHTML = progressBarHTML;
                list.appendChild(progressCounterEl);
                list.appendChild(progressBarEl);
            }
            this.resultsDiv.appendChild(list);
        }
        this.indicate_component_ready();
    }
    disableOptions() { }
    async checkPollStorage() {
        //checks the localstorage to see if the poll has been completed already
        var _this = this;
        var len = localStorage.length;
        if (len > 0) {
            //If the poll has already been completed, show the results
            var data = {};
            data.div_id = this.divid;
            data.course = eBookConfig.course;
            try {
                const params = new URLSearchParams(data);
                const resp = await fetch(`${eBookConfig.new_server_prefix}/assessment/getpollresults?${params.toString()}`);
                const json = await resp.json();
                this.showPollResults(json);
            } catch (e) {
                this.indicate_component_ready();
            }
        } else {
            this.indicate_component_ready();
        }
    }
}

// Do not render poll data until login-complete event so we know instructor status
document.addEventListener("runestone:login-complete", function () {
    document.querySelectorAll("[data-component=poll]").forEach(function (el, index) {
        try {
            window.componentMap[el.id] = new Poll({ orig: el });
        } catch (err) {
            console.log(`Error rendering Poll Problem ${el.id}
                         Details: ${err}`);
            console.log(err.stack);
        }
    });
});

if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}
window.component_factory.poll = function (opts) {
    return new Poll(opts);
};
