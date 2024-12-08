import RunestoneBase from "../../common/js/runestonebase.js";

export class SpliceWrapper extends RunestoneBase {
    constructor() {
        super();
        this.initSplice();
    }

    initSplice() {
        // SPLICE Events
        window.addEventListener("message", (event) => {
            //console.log("got a message", event);
            // if you uncomment the above you get a message about every 1/2 second from React
            // that is just a keepalive message of some kind
            if (event.data.subject == "SPLICE.reportScoreAndState") {
                console.log("Got SPLICE.reportScoreAndState");
                console.log(event.data.location);
                console.log(event.data.score);
                console.log(event.data.state);
                let location = event.data.location;
                if (!location) {
                    location = event.target.location.href;
                }
                this.logBookEvent({
                    event: event.data.subject,
                    div_id: location,
                    act: `score: ${event.data.score}`,
                    score: event.data.score,
                    correct: event.data.score == 1.0 ? true : false,
                    state: event.data.state,
                });
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
                event.source.postMessage(
                    {
                        subject: "SPLICE.getState.response",
                        state: event.data.state,
                    },
                    event.origin
                );
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
    checkLocalStorage() {}
    setLocalStorage() {}
    restoreAnswers() {}
    disableInteraction() {}
}

