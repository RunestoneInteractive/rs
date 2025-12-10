import ShortAnswer from "./shortanswer.js";

export default class TimedShortAnswer extends ShortAnswer {
    constructor(opts) {
        super(opts);
        this.renderTimedIcon(this.containerDiv);
        this.isTimed = true;
        this.hideButtons();
    }
    hideButtons() {
        if (this.submitButton) {
            this.submitButton.style.display = "none";
        }
    }
    renderTimedIcon(component) {
        // renders the clock icon on timed components.    The component parameter
        // is the element that the icon should be appended to.
        var timeIconDiv = document.createElement("div");
        var timeIcon = document.createElement("img");

        timeIcon.src = "../_static/clock.png";
        timeIcon.style.width = "15px";
        timeIcon.style.height = "15px";

        timeIconDiv.className = "timeTip";
        timeIconDiv.title = "";
        timeIconDiv.appendChild(timeIcon);

        // If firstChild is null, insertBefore acts like appendChild
        component.insertBefore(timeIconDiv, component.firstChild);
    }
    checkCorrectTimed() {
        return "I"; // we ignore this in the grading
    }
    hideFeedback() {
        if (this.feedbackDiv) {
            this.feedbackDiv.style.display = "none";
        }
    }
}

if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}

window.component_factory.shortanswer = function (opts) {
    if (opts.timed) {
        return new TimedShortAnswer(opts);
    }
    return new ShortAnswer(opts);
};
