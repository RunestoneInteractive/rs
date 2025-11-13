import RunestoneBase from "../../common/js/runestonebase.js";

export class SpliceWrapper extends RunestoneBase {
    constructor() {
        super();
        this.initSplice();
    }

    initSplice() {
        // SPLICE Events
        window.addEventListener("message", async (event) => {
            console.log("SpliceWrapper: received message subject:", event.data.subject);
            if (event.data.subject == "SPLICE.reportScoreAndState") {
                this.handleScoreAndState(event);
            } else if (event.data.subject == "SPLICE.sendEvent") {
                this.handleSpliceEvent(event);
            } else if (event.data.subject == "SPLICE.getState") {
                await this.handleGetState(event);
            } else if (
                event.origin === "https://www.myopenmath.com" &&
                typeof event.data === "string" &&
                event.data.indexOf("lti.ext.imathas.result") != -1
            ) {
                // proof of concept for My Open Math
                let msgdata = JSON.parse(event.data);
                let jwt = basicParseJwt(msgdata.jwt);
                console.log(
                    "Result received from frame " +
                        msgdata.frame_id +
                        " with score " +
                        jwt.score
                );
                // todo send score to server
                // does MOM have a way to get the state?
                // todo send state to server
            }
        });
    }

    getUniqueID(event) {
        // Determine the unique identifier for this activity
        // The SPLICE protocol allows for two possibilities
        // 1. activity_id is the unique id as assigned by the provider
        // 2. activity_id is the iframe src url
        // if the activity_id is set there may also be another attribute called domain
        let location = event.data.activity_id;
        if (!location) {
            let frame = this.sendingIframe(event);
            if (frame) {
                location = frame.src;
            } else {
                location = "unknown";
                console.error(
                    "Could not find iframe that sent the score event"
                );
            }
        }
        return location;
    }

    handleScoreAndState(event) {
        console.log("Got SPLICE.reportScoreAndState");
        console.log(event.data.activity_id);
        console.log(event.data.score);
        console.log(event.data.state);
        let location = this.getUniqueID(event);
        this.logBookEvent({
            event: event.data.subject,
            div_id: location,
            act: `score: ${event.data.score}`,
            score: event.data.score,
            percent: event.data.score,
            correct: event.data.score == 1.0 ? true : false,
            answer: JSON.stringify(event.data.state),
        });
    }

    sendingIframe(event) {
        // determine the iframe that sent the event
        // you would think that event.source would be the iframe
        // but it is not and getting the location out of event.source
        // creates CORS issues.
        for (const f of document.getElementsByTagName("iframe")) {
            if (f.contentWindow === event.source) return f;
        }
        return undefined;
    }

    async getSavedState(location) {
        // fetch the state from the server
        try {
            const response = await fetch("/ns/assessment/results", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    div_id: location,
                    course: eBookConfig.course,
                    event: "SPLICE.getState",
                }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching SPLICE state:", error);
            return null;
        }
    }

    async handleGetState(event) {
        console.log("Got SPLICE.getState");
        console.log(event.data.activity_id);
        console.log(event.data.state);
        // subject is SPLICE.getState.response
        let location = this.getUniqueID(event);
        let res = await this.getSavedState(location);
        let state = res.detail.answer;
        event.source.postMessage(
            {
                message_id: event.data.message_id,
                subject: "SPLICE.getState.response",
                state: state,
            },
            "*"
        );
    }

    handleSpliceEvent(event) {
        // handle generic SPLICE events, such as logged clicks
        // or other events.  SPLICE does not require that we do
        // anything with them, but in keeping with our tradition
        // we will save them to the useinfo table in the database
        // in case they prove to be useful for research later
        console.log("Got SPLICE.sendEvent");
        console.log(event.data.activity_id);
        console.log(event.data.name);
        //console.log(event.data.data);
        let location = this.getUniqueID(event);
        this.logBookEvent({
            event: event.data.subject,
            div_id: location,
            act: event.data.name,
        });
    }
    // these stubs are not implemented, but are required by the RunestoneBase class
    checkLocalStorage() {}
    setLocalStorage() {}
    restoreAnswers() {}
    disableInteraction() {}
}

function basicParseJwt(token) {
    var base64Url = token.split(".")[1];
    var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    var jsonPayload = decodeURIComponent(
        window
            .atob(base64)
            .split("")
            .map(function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join("")
    );
    return JSON.parse(jsonPayload);
}
