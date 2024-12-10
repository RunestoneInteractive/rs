import RunestoneBase from "../../common/js/runestonebase.js";

export class SpliceWrapper extends RunestoneBase {
    constructor() {
        super();
        this.initSplice();
    }

    initSplice() {
        // SPLICE Events
        window.addEventListener("message", async (event) => {
            //console.log("got a message", event);
            // if you uncomment the above you get a message about every 1/2 second from React
            // that is just a keepalive message of some kind
            if (event.data.subject == "SPLICE.reportScoreAndState") {
                this.handleScoreAndState(event);
            } else if (event.data.subject == "SPLICE.sendEvent") {
                console.log("Got SPLICE.sendEvent");
                console.log(event.data.location);
                console.log(event.data.name);
                console.log(event.data.data);
            } else if (event.data.subject == "SPLICE.getState") {
                console.log("Got SPLICE.getState");
                console.log(event.data.location);
                console.log(event.data.state);
                // Get the state from the DB
                // Get the location and get the saved state from the DB
                // event.source.postMessage to send data back
                // subject is SPLICE.getState.response
                let location = this.getLocation(event);
                let res = await this.getSavedState(location);
                let state = res.detail.answer;
                event.source.postMessage({
                    message_id: event.data.message_id,
                    subject: "SPLICE.getState.response",
                    state: state,
                });
            } else if (
                event.origin === "https://www.myopenmath.com" &&
                typeof event.data === "string" &&
                event.data.indexOf("lti.ext.imathas.result") != -1
            ) {
                let msgdata = JSON.parse(event.data);
                let jwt = basicParseJwt(msgdata.jwt);
                console.log(
                    "Result received from frame " +
                        msgdata.frame_id +
                        " with score " +
                        jwt.score
                );
                //console.log(event.data.jwt);  // signed jwt from MyOpenMath
                //console.log(event.data.frame_id)
            }
        });
    }

    getLocation(event) {
        let location = event.data.location;
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
        console.log(event.data.location);
        console.log(event.data.score);
        console.log(event.data.state);
        let location = this.getLocation(event);
        this.logBookEvent({
            event: event.data.subject,
            div_id: location,
            act: `score: ${event.data.score}`,
            score: event.data.score,
            correct: event.data.score == 1.0 ? true : false,
            answer: JSON.stringify(event.data.state),
        });
    }

    sendingIframe(event) {
        for (const f of document.getElementsByTagName("iframe")) {
            if (f.contentWindow === event.source) return f;
        }
        return undefined;
    }

    async getSavedState(location) {
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

    checkLocalStorage() {}
    setLocalStorage() {}
    restoreAnswers() {}
    disableInteraction() {}
}
