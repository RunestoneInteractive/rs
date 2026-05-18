import RunestoneBase from "../../common/js/runestonebase.js";

interface SpliceMessageData {
    subject: string;
    activity_id?: string;
    score?: number;
    state?: unknown;
    name?: string;
    message_id?: string;
    frame_id?: string;
    jwt?: string;
}

interface SavedStateResponse {
    detail: {
        answer: unknown;
    };
}

interface JwtPayload {
    score: number;
    [key: string]: unknown;
}

declare const eBookConfig: {
    course: string;
    [key: string]: unknown;
};

export class SpliceWrapper extends RunestoneBase {
    constructor() {
        super();
        this.initSplice();
    }

    initSplice(): void {
        // SPLICE Events
        window.addEventListener("message", async (event: MessageEvent<SpliceMessageData>) => {
            var sourceIframe = this.sendingIframe(event);
            console.log(`SpliceWrapper: received message subject: ${event.data.subject} from iframe: ${sourceIframe ? sourceIframe.id : "unknown"}`);
            if (event.data.subject == "SPLICE.reportScoreAndState") {
                this.handleScoreAndState(event, sourceIframe);
            } else if (event.data.subject == "SPLICE.sendEvent") {
                this.handleSpliceEvent(event, sourceIframe);
            } else if (event.data.subject == "SPLICE.getState") {
                await this.handleGetState(event, sourceIframe);
            } else if (
                event.origin === "https://www.myopenmath.com" &&
                typeof event.data === "string" &&
                (event.data as unknown as string).indexOf("lti.ext.imathas.result") != -1
            ) {
                // proof of concept for My Open Math
                let msgdata = JSON.parse(event.data as unknown as string);
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

    getUniqueID(event: MessageEvent<SpliceMessageData>, frame: HTMLIFrameElement | undefined): string {
        // Determine the unique identifier for this activity
        // The SPLICE protocol allows for two possibilities
        // 1. activity_id is the unique id as assigned by the provider
        // 2. activity_id is the iframe src url
        // if the activity_id is set there may also be another attribute called domain
        // On Runestone we will try to map the activity to the div_id of the enclosing RS component
        // if possible, otherwise we will use the activity_id or iframe src
        // If an interactive is included in an exercises this allows us to map the score
        // to the id the instructor used to assign the problem.
        if (frame) {
            let rsDiv = frame.closest("[data-component]");
            if (rsDiv) {
                return rsDiv.id;
            }
        }
        let location = event.data.activity_id;
        if (!location) {
            if (frame) {
                location = frame.src;
            } else {
                location = "unknown";
                console.error(
                    "Could not find iframe that sent the SPLICE event"
                );
            }
        }
        return location;
    }

    handleScoreAndState(event: MessageEvent<SpliceMessageData>, frame: HTMLIFrameElement | undefined): void {
        console.log("Got SPLICE.reportScoreAndState");
        console.log(event.data.activity_id);
        console.log(event.data.score);
        console.log(event.data.state);
        let location = this.getUniqueID(event, frame);
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

    sendingIframe(event: MessageEvent): HTMLIFrameElement | undefined {
        // determine the iframe that sent the event
        // you would think that event.source would be the iframe
        // but it is not and getting the location out of event.source
        // creates CORS issues.
        for (const f of document.getElementsByTagName("iframe")) {
            if (f.contentWindow === event.source) return f;
        }
        return undefined;
    }

    async getSavedState(location: string): Promise<SavedStateResponse | null> {
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
            const data: SavedStateResponse = await response.json();
            return data;
        } catch (error) {
            console.error("Error fetching SPLICE state:", error);
            return null;
        }
    }

    async handleGetState(event: MessageEvent<SpliceMessageData>, frame: HTMLIFrameElement | undefined): Promise<void> {
        console.log("Got SPLICE.getState");
        console.log(event.data.activity_id);
        console.log(event.data.state);
        // subject is SPLICE.getState.response
        let location = this.getUniqueID(event, frame);
        let res = await this.getSavedState(location);
        let state = res?.detail.answer;
        (event.source as Window).postMessage(
            {
                message_id: event.data.message_id,
                subject: "SPLICE.getState.response",
                state: state,
            },
            "*"
        );
    }

    handleSpliceEvent(event: MessageEvent<SpliceMessageData>, frame: HTMLIFrameElement | undefined): void {
        // handle generic SPLICE events, such as logged clicks
        // or other events.  SPLICE does not require that we do
        // anything with them, but in keeping with our tradition
        // we will save them to the useinfo table in the database
        // in case they prove to be useful for research later
        console.log("Got SPLICE.sendEvent");
        console.log(event.data.activity_id);
        console.log(event.data.name);
        let location = this.getUniqueID(event, frame);
        this.logBookEvent({
            event: event.data.subject,
            div_id: location,
            act: event.data.name || "unknown",
        });
    }

    // these stubs are not implemented, but are required by the RunestoneBase class
    checkLocalStorage(): void {}
    setLocalStorage(): void {}
    restoreAnswers(): void {}
    disableInteraction(): void {}
}

function basicParseJwt(token: string): JwtPayload {
    var base64Url = token.split(".")[1];
    var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    var jsonPayload = decodeURIComponent(
        window
            .atob(base64)
            .split("")
            .map(function (c: string): string {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join("")
    );
    return JSON.parse(jsonPayload) as JwtPayload;
}
