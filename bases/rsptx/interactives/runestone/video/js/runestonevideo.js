"use strict";

import RunestoneBase from "../../common/js/runestonebase";
import { getDataValue } from "../../common/js/domutil.js";
import "../css/video.css";

class RunestoneVideo extends RunestoneBase {
    constructor(opts) {
        super(opts);
        this.divid = opts.orig.id;
        this.container = document.getElementById(this.divid);
        this.caption = "YouTube";
        if (document.getElementById("youtubescript") == null) {
            let script = document.createElement("script");
            script.id = "youtubescript";
            script.src = "https://www.youtube.com/player_api";
            document.body.appendChild(script);
        }
        this.containerDiv = this.container.parentElement;
        this.addCaption("runestone");
        this.indicate_component_ready();
    }
}

window.onPlayerStateChange = function (event) {
    let rb = new RunestoneBase();
    let videoTime = event.target.getCurrentTime();
    let data = {
        event: "video",
        div_id: event.target.getIframe().id,
    };
    if (event.data == YT.PlayerState.PLAYING) {
        console.log("playing " + event.target.getIframe().id);
        data.act = "play:" + videoTime;
    } else if (event.data == YT.PlayerState.ENDED) {
        console.log("ended " + event.target.getIframe().id);
        data.act = "complete";
    } else if (event.data == YT.PlayerState.PAUSED) {
        console.log("paused at " + videoTime);
        data.act = "pause:" + videoTime;
    } else {
        console.log(`YT Player State: ${YT.PlayerState}`);
        data.act = "ready";
    }
    rb.logBookEvent(data);
};

//Callback function to load youtube videos once IFrame Player loads
window.onYouTubeIframeAPIReady = function () {
    for (let video of document.querySelectorAll(".youtube-video")) {
        let playerVars = {};
        playerVars["start"] = getDataValue(video, "video-start");
        if (getDataValue(video, "video-end") != -1)
            playerVars["end"] = getDataValue(video, "video-end");
        let player = new YT.Player(getDataValue(video, "video-divid"), {
            height: getDataValue(video, "video-height"),
            width: getDataValue(video, "video-width"),
            videoId: getDataValue(video, "video-videoid"),
            align: "center",
            playerVars: playerVars,
            events: {
                onStateChange: window.onPlayerStateChange,
            },
        });
    }
};

//Need to make sure the YouTube IFrame Player API is not loaded until after
// all YouTube videos are in the DOM. Add a script tag with it after document is loaded
function addPlayerApiScript() {
    let script = document.createElement("script");
    script.src = "https://www.youtube.com/player_api";
    document.body.appendChild(script);
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addPlayerApiScript);
} else {
    addPlayerApiScript();
}

document.addEventListener("runestone:login-complete", function () {
    for (let element of document.querySelectorAll(
        "[data-component=youtube]",
    )) {
        var opts = {
            orig: element,
            useRunestoneServices: eBookConfig.useRunestoneServices,
        };
        window.componentMap[element.id] = new RunestoneVideo(opts);
    }
});

if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}
window.component_factory.youtube = function (opts) {
    return new RunestoneVideo(opts);
};

window.component_factory.vimeo = function (opts) {
    return new RunestoneVideo(opts);
};
