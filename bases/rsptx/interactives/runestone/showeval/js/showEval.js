/*
ShowEval, a JS module for creating visualizations of expression evaluation.
Mainly for programming tutorials.

Al Sweigart
al@inventwithpython.com
https://github.com/asweigart/

This is Al's jQuery-free 0.10.0 core wrapped as a Runestone component (the
component features -- annotations, logging, per-question buttons -- come
from the old 0.9.1-based showEval.js it replaces). The standalone variant
used by PreTeXt <interactive> slates is served from the Runestone CDN as
showEval-0.10.0.js and is not built from this module.
*/
"use strict";

import RunestoneBase from "../../common/js/runestonebase";
import { getDataValue } from "../../common/js/domutil.js";
import "../css/showEval.css";

export class ShowEval extends RunestoneBase {
    constructor(opts) {
        super(opts);
        this.divid = opts.orig.id;
        this.containerDiv = opts.orig;
        this.containerDiv.classList.add("showEval");
        let steps = [];
        for (let s of opts.raw) {
            steps.push(s.replace(/\\/g, ""));
        }
        this.steps = steps.slice();
        this.currentStep = 0;
        this.createTrace = getDataValue(opts.orig, "tracemode"); // TODO - reset doesn't work for traces

        // create elements
        this.currentStepDiv = document.createElement("div");
        this.currentStepDiv.classList.add("currentStepDiv");
        this.containerDiv.appendChild(this.currentStepDiv);
        for (const part of ["pre", "eval", "post"]) {
            let span = document.createElement("span");
            span.classList.add(part);
            this.currentStepDiv.appendChild(span);
        }
        this.annoDiv = document.createElement("div");
        this.annoDiv.classList.add("anno");
        this.currentStepDiv.appendChild(this.annoDiv);
        this.evalSpan = this.currentStepDiv.querySelector(".eval");
        this.setNextButton(`#${this.divid}_nextStep`);
        this.setResetButton(`#${this.divid}_reset`);

        // parse steps and turn into a 5-string array:
        // ['pre', 'before eval', 'after eval', 'post', 'anno']
        for (var i = 0; i < this.steps.length; i++) {
            var s = this.steps[i];
            let endpoint, comment;

            if (s.includes("##")) {
                // If there is an annotation
                endpoint = s.indexOf("##");
                comment = s.substring(endpoint + 2, s.length);
            } else {
                endpoint = s.length;
                comment = false;
            }
            this.steps[i] = [
                s.substring(0, s.indexOf("{{")), // 'pre'
                s.substring(s.indexOf("{{") + 2, s.indexOf("}}{{")), // 'before eval'
                s.substring(
                    s.indexOf("}}{{") + 4,
                    s.indexOf("}}", s.indexOf("}}{{") + 4),
                ), // 'after eval'
                s.substring(
                    s.indexOf("}}", s.indexOf("}}{{") + 4) + 2,
                    endpoint,
                ), // 'post'
            ];
            this.steps[i].push(comment); // 'anno'
        }
        this.reset();
        this.caption = "ShowEval";
        this.addCaption("runestone");
        this.indicate_component_ready();
    }

    setNextButton(nextButtonSelector) {
        const button = document.querySelector(nextButtonSelector);
        button?.addEventListener("click", () => {
            this.evaluateStep(button);
        });
    }

    setResetButton(resetButtonSelector) {
        document
            .querySelector(resetButtonSelector)
            ?.addEventListener("click", () => {
                this.reset();
            });
    }

    reset() {
        for (const el of this.containerDiv.querySelectorAll(
            ".previousStep",
        )) {
            el.remove();
        }
        this.setStep(0);
        this.logBookEvent({
            event: "showeval",
            act: "reset",
            div_id: this.containerDiv.id,
        });
    }

    setStep(step) {
        this.currentStep = step;
        let newWidth = this.getWidth(this.steps[this.currentStep][1]);
        if (this.steps[step][4]) {
            this.annoDiv.innerHTML = this.steps[step][4];
            this.annoDiv.style.display = "";
        } else {
            this.annoDiv.style.display = "none";
        }
        this.evalSpan.style.width = newWidth + "px";
        this.currentStepDiv.querySelector(".pre").innerHTML =
            this.steps[step][0];
        this.evalSpan.innerHTML = this.steps[step][1];
        this.currentStepDiv.querySelector(".post").innerHTML =
            this.steps[step][3];
    }

    getWidth(text) {
        // TODO - class style must match or else width will be off.
        var newElem = document.createElement("div");
        newElem.classList.add("showEval", "evalCont");
        newElem.style.display = "none";
        newElem.innerHTML = text;
        document.body.appendChild(newElem);
        var newWidth = newElem.offsetWidth + 1; // +1 is a hack
        newElem.remove();

        return newWidth;
    }

    createPreviousStepDiv(step) {
        let prevDiv = document.createElement("div");
        prevDiv.classList.add("previousStep");
        prevDiv.innerHTML =
            this.steps[step][0] + this.steps[step][1] + this.steps[step][3];
        this.currentStepDiv.before(prevDiv);
    }

    evaluateStep(button, step) {
        this.annoDiv.style.display = "none";
        if (button) {
            button.disabled = true;
        }
        if (step === undefined) {
            step = this.currentStep;
        }
        if (this.currentStep >= this.steps.length) {
            if (button) {
                button.disabled = false;
            }
            return; // do nothing if on last step
        }

        var fadeInSpeed = 0;
        if (this.createTrace) {
            this.createPreviousStepDiv(step);
            this.currentStepDiv.style.display = "none";
            fadeInSpeed = 200;
        }

        let newWidth = this.getWidth(this.steps[step][2]);
        var evalElem = this.evalSpan;

        var thisShowEval = this;

        evalElem.style.color = "red";

        // Fade in currentStepDiv
        this.fadeToOpacity(this.currentStepDiv, 1, fadeInSpeed, function () {
            window.setTimeout(function () {
                // Fade out evalElem
                thisShowEval.fadeToOpacity(evalElem, 0, 400, function () {
                    // Animate width
                    thisShowEval.animateWidth(
                        evalElem,
                        newWidth,
                        400,
                        function () {
                            evalElem.innerHTML = thisShowEval.steps[step][2];
                            // Fade in evalElem
                            thisShowEval.fadeToOpacity(
                                evalElem,
                                1,
                                400,
                                function () {
                                    window.setTimeout(function () {
                                        evalElem.style.color = "#333";
                                        thisShowEval.currentStep += 1;
                                        if (
                                            thisShowEval.currentStep <
                                            thisShowEval.steps.length
                                        ) {
                                            thisShowEval.setStep(
                                                thisShowEval.currentStep,
                                            );
                                        }
                                        if (button) {
                                            button.disabled = false;
                                        }
                                    }, 600);
                                },
                            );
                        },
                    );
                });
            }, 600);
        });

        this.logBookEvent({
            event: "showeval",
            act: "next",
            div_id: this.containerDiv.id,
        });
    }

    // Helper function to fade element to specific opacity
    fadeToOpacity(element, targetOpacity, duration, callback) {
        if (duration === 0) {
            element.style.opacity = targetOpacity;
            if (targetOpacity === 1 && element.style.display === "none") {
                element.style.display = "";
            }
            if (callback) callback();
            return;
        }

        var startOpacity =
            parseFloat(window.getComputedStyle(element).opacity) || 0;
        var startTime = performance.now();

        if (targetOpacity === 1 && element.style.display === "none") {
            element.style.display = "";
            element.style.opacity = startOpacity;
        }

        function animate(currentTime) {
            var elapsed = currentTime - startTime;
            var progress = Math.min(elapsed / duration, 1);

            element.style.opacity =
                startOpacity + (targetOpacity - startOpacity) * progress;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (callback) callback();
            }
        }

        requestAnimationFrame(animate);
    }

    // Helper function to animate width
    animateWidth(element, targetWidth, duration, callback) {
        var startWidth = element.offsetWidth;
        var startTime = performance.now();

        function animate(currentTime) {
            var elapsed = currentTime - startTime;
            var progress = Math.min(elapsed / duration, 1);

            element.style.width =
                startWidth + (targetWidth - startWidth) * progress + "px";

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (callback) callback();
            }
        }

        requestAnimationFrame(animate);
    }
}

/*=================================
== Find the custom HTML tags and ==
==   execute our code on them    ==
=================================*/
document.addEventListener("runestone:login-complete", function () {
    for (let element of document.querySelectorAll(
        "[data-component=showeval]",
    )) {
        var opts = {
            orig: element,
            useRunestoneServices: eBookConfig.useRunestoneServices,
        };
        opts.raw = window.raw_steps[element.id];
        if (!element.closest("[data-component=timedAssessment]")) {
            // If this element exists within a timed component, don't render it here
            window.componentMap[element.id] = new ShowEval(opts);
        }
    }
});

if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}
window.component_factory["showeval"] = function (opts) {
    return new ShowEval(opts);
};
