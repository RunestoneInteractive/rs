import RunestoneBase from "../../common/js/runestonebase";

window.wwList = {}; // Multiple Choice dictionary

class WebWork extends RunestoneBase {
    constructor(opts) {
        super(opts);
        this.useRunestoneServices = true;
        this.multipleanswers = false;
        this.divid = opts.orig.id;
        this.correct = null;
        this.optional = false;
        this.answerList = [];
        this.correctList = [];
        this.question = null;
        this.caption = "WebWork";
        this.containerDiv = opts.orig;
        this.answers = {};
        this.percent = 0;
        //this.addCaption("runestone");
        if (this.divid !== "fakeww-ww-rs") {
            this.checkServer("webwork", true);
        }
        window.wwList[this.divid] = this;
    }

    restoreAnswers(data) {
        // Restore answers from storage retrieval done in RunestoneBase
        // sometimes data.answer can be null
        if (!data.answer) {
            data.answer = "";
        }
        // data.answers comes from postgresql as a JSON column type so no need to parse it.

        this.answers = data.answer;
        this.correct = data.correct;
        this.percent = data.percent;
        console.log(
            `about to decorate the status of WW ${this.divid} ${this.correct}`
        );
        this.decorateStatus();
    }

    checkLocalStorage() {
        // Repopulates MCMA questions with a user's previous answers,
        // which were stored into local storage.
        var storedData;
        var answers;
        if (this.graderactive) {
            return;
        }
        var len = localStorage.length;
        var ex = localStorage.getItem(this.localStorageKey());

        if (ex !== null) {
            try {
                storedData = JSON.parse(ex);
                // Save the answers so that when the question is activated we can restore.
                this.answers = storedData.answer;
                this.correct = storedData.correct;
                this.percent = storedData.percent;
                // We still decorate the webwork question even if it is not active.
                this.decorateStatus();
            } catch (err) {
                // error while parsing; likely due to bad value stored in storage
                console.log(err.message);
                localStorage.removeItem(this.localStorageKey());
                return;
            }
        }
    }

    setLocalStorage(data) {
        var timeStamp = new Date();
        var storageObj = {
            answer: data.answer,
            timestamp: timeStamp,
            correct: data.correct,
        };
        localStorage.setItem(
            this.localStorageKey(),
            JSON.stringify(storageObj)
        );
    }

    // This is called when the runestone_ww_check event is triggered by the webwork problem
    // Note the webwork problem is in an iframe so we rely on this event and the data
    // compiled and passed along with the event to "grade" the answer.
    processCurrentAnswers(data) {
        let correctCount = 0;
        let qCount = 0;
        let actString = "check:";
        this.answerObj = {};
        this.lastAnswerRaw = data;
        this.answerObj.answers = {};
        this.answerObj.mqAnswers = {};
        // data.inputs_
        for (let k of Object.keys(data.rh_result.answers)) {
            qCount += 1;
            if (data.rh_result.answers[k].score == 1) {
                correctCount += 1;
            }
            // mostly grab original_student_ans, but grab student_value for MC exercises
            let student_ans;
            if (
                !("ww_version" in data) ||
                data.ww_version.includes("2.16") ||
                data.ww_version.includes("2.17") ||
                data.ww_version.includes("2.18")
            ) {
                // Mostly grab original_student_ans, but grab student_value for MC exercises
                student_ans = [
                    "Value (parserRadioButtons)",
                    "Value (PopUp)",
                    "Value (CheckboxList)",
                ].includes(data.rh_result.answers[k].type)
                    ? data.rh_result.answers[k].student_value
                    : data.rh_result.answers[k].original_student_ans;
            } else {
                // Literally get the input refs
                // data.inputs_ref[k] will usually be a string, the @value of the answer input field that was submitted
                // However in at least the case of checkboxes, data.inputs_ref[k] will be an array
                // So however this is ultimately stored in the Runestone database should respect ans preserve this as an array, not stringified
                student_ans = data.inputs_ref[k];
            }
            this.answerObj.answers[k] = student_ans;
            let mqKey = `MaThQuIlL_${k}`;
            this.answerObj.mqAnswers[mqKey] = data.inputs_ref[mqKey];
            actString += `actual:${student_ans}:expected:${data.rh_result.answers[k].correct_value}:`;
        }
        let pct = correctCount / qCount;
        // If this.percent is set, then runestonebase will transmit it as part of
        // the logBookEvent API.
        this.percent = pct;
        this.actString =
            actString + `correct:${correctCount}:count:${qCount}:pct:${pct}`;
        if (pct == 1.0) {
            this.correct = true;
        } else {
            this.correct = false;
        }
        let ls = {};
        ls.answer = this.answerObj;
        ls.correct = this.correct;
        ls.percent = this.percent;
        this.setLocalStorage(ls);
        this.decorateStatus();
    }

    async logCurrentAnswer(sid) {
        this.logBookEvent({
            event: "webwork",
            div_id: this.divid, //todo unmangle problemid
            act: this.actString,
            correct: this.correct,
            answer: JSON.stringify(this.answerObj),
        });
    }

    checkCurrentAnswer() {}
}

//
// These are functions that get called in response to webwork generated events.
// submitting the work, or showing an answer.
function logWebWork(e, data) {
    if (eBookConfig.useRunestoneServices) {
        let wwObj = wwList[data.inputs_ref.problemUUID.replace("-ww-rs", "")];
        if (wwObj) {
            wwObj.processCurrentAnswers(data);
            wwObj.logCurrentAnswer();
        } else {
            console.log(
                `Error: Could not find webwork object ${data.inputs_ref.problemUUID}`
            );
        }
    }
}

function logShowCorrect(e, data) {
    if (eBookConfig.useRunestoneServices) {
        let wwObj = wwList[data.inputs_ref.problemUUID.replace("-ww-rs", "")];
        if (wwObj) {
            wwObj.logBookEvent({
                event: "webwork",
                div_id: data.inputs_ref.problemUUID,
                act: "show",
            });
        } else {
            console.log(
                `Error: Could not find webwork object ${data.inputs_ref.problemUUID}`
            );
        }
    }
}

async function getScores(sid, wwId) {}

if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}

window.component_factory.webwork = function (opts) {
    return new WebWork(opts);
};

$(function () {
    $("body").on("runestone_ww_check", logWebWork);
    $("body").on("runestone_show_correct", logShowCorrect);
});

$(document).on("runestone:login-complete", function () {
    $("[data-component=webwork]").each(function (index) {
        // MC
        var opts = {
            orig: this,
            useRunestoneServices: eBookConfig.useRunestoneServices,
        };
        if ($(this).closest("[data-component=timedAssessment]").length == 0) {
            // If this element exists within a timed component, don't render it here
            window.wwList[this.id] = new WebWork(opts);
        }
    });
});
