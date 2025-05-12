import {MatchingProblem} from "./matching.js";

export default class TimedMatching extends MatchingProblem {
    constructor(opts) {
        super(opts);
        this.renderTimedIcon(this.containerDiv);
        this.hideButtons();
        this.needsReinitialization = true;
    }

    hideButtons() {
        this.gradeBtn.style.display = "none";
        this.helpBtn.style.display = "none";
    }

    renderTimedIcon(component) {
        // renders the clock icon on timed components. The component parameter
        // is the element that the icon should be appended to.
        var timeIconDiv = document.createElement("div");
        var timeIcon = document.createElement("img");
        timeIcon.src = "../_static/clock.png";
        timeIcon.style.width = "15px";
        timeIcon.style.height = "15px";

        timeIconDiv.className = "timeTip";
        timeIconDiv.title = "";
        timeIconDiv.appendChild(timeIcon);
        component.prepend(timeIconDiv);
    }

    checkCorrectTimed() {
        // Returns if the question was correct, incorrect, or skipped (return null in the last case)
        switch (this.correct) {
            case true:
                return "T";
            case false:
                return "F";
            default:
                return null;
        }
    }

    hideFeedback() {
        this.connList.style.display = "none";
    }

    reinitializeListeners() {
        // maybe need to reinitialize the listeners
    }
}

if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}
window.component_factory.matching = function (opts) {
    if (opts.timed) {
        return new TimedMatching(opts);
    }
    return new MatchingProblem(opts);
};
