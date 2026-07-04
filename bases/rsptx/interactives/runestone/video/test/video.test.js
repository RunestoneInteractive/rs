// Characterization tests for the RunestoneVideo (youtube/vimeo) component.
// These were first written against the jQuery implementation and now guard
// the jQuery-free version.
// Note: deliberately NO jquery-globals import here -- video must work
// without jQuery.
import { describe, it, expect, beforeEach, vi } from "vitest";
import "../js/runestonevideo.js";
import RunestoneBase from "../../common/js/runestonebase.js";

// A book page renders the video directive as a .youtube-video div (carrying
// the data-video-* attributes) inside a .runestone container.
function makeFixture({ id = "test_video_1", attrs = "" } = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="youtube" id="${id}" class="youtube-video"
             data-video-height="315" data-video-width="560"
             data-video-videoid="dQw4w9WgXcQ" data-video-divid="${id}"
             data-video-start="0" data-video-end="-1" ${attrs}></div>
      </div>`;
    return document.getElementById(id);
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
    document.body.innerHTML = "";
    document.getElementById("youtubescript")?.remove();
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("construction", () => {
    it("uses the parent of the video div as its container and captions it", async () => {
        const orig = makeFixture();
        const video = new window.component_factory.youtube({ orig });
        await video.component_ready_promise;
        expect(video.containerDiv).toBe(orig.parentElement);
        const caption = video.containerDiv.querySelector(".runestone_caption");
        expect(caption.textContent).toBe("YouTube");
    });

    it("injects the YouTube player API script exactly once", async () => {
        const orig = makeFixture();
        new window.component_factory.youtube({ orig });
        const script = document.getElementById("youtubescript");
        expect(script.src).toContain("youtube.com/player_api");
        new window.component_factory.vimeo({ orig: makeFixture({ id: "v2" }) });
        expect(
            document.querySelectorAll("#youtubescript").length,
        ).toBe(1);
    });
});

describe("page wiring", () => {
    it("builds a component for each [data-component=youtube] at login-complete", async () => {
        makeFixture({ id: "wired_video" });
        document.dispatchEvent(new CustomEvent("runestone:login-complete"));
        await tick();
        expect(window.componentMap.wired_video).toBeDefined();
        expect(window.componentMap.wired_video.divid).toBe("wired_video");
    });
});

describe("onYouTubeIframeAPIReady", () => {
    it("creates a YT.Player per .youtube-video with coerced data attributes", () => {
        makeFixture({ id: "yt_a" });
        const Player = vi.fn();
        vi.stubGlobal("YT", { Player });
        window.onYouTubeIframeAPIReady();
        expect(Player).toHaveBeenCalledTimes(1);
        const [divid, config] = Player.mock.calls[0];
        expect(divid).toBe("yt_a");
        expect(config.height).toBe(315);
        expect(config.width).toBe(560);
        expect(config.videoId).toBe("dQw4w9WgXcQ");
        expect(config.playerVars).toEqual({ start: 0 });
        expect(config.events.onStateChange).toBe(window.onPlayerStateChange);
    });

    it("passes an end time when data-video-end is not -1", () => {
        makeFixture({ id: "yt_b" });
        document
            .getElementById("yt_b")
            .setAttribute("data-video-end", "90");
        const Player = vi.fn();
        vi.stubGlobal("YT", { Player });
        window.onYouTubeIframeAPIReady();
        expect(Player.mock.calls[0][1].playerVars).toEqual({
            start: 0,
            end: 90,
        });
    });
});

describe("onPlayerStateChange", () => {
    const PlayerState = { PLAYING: 1, ENDED: 0, PAUSED: 2 };

    function fireState(data) {
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        window.onPlayerStateChange({
            data,
            target: {
                getCurrentTime: () => 42,
                getIframe: () => ({ id: "test_video_1" }),
            },
        });
        return logSpy;
    }

    beforeEach(() => {
        vi.stubGlobal("YT", { PlayerState });
    });

    it("logs play with the current time", () => {
        const logSpy = fireState(PlayerState.PLAYING);
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "video",
                div_id: "test_video_1",
                act: "play:42",
            }),
        );
    });

    it("logs completion when the video ends", () => {
        const logSpy = fireState(PlayerState.ENDED);
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({ act: "complete" }),
        );
    });

    it("logs pause with the current time", () => {
        const logSpy = fireState(PlayerState.PAUSED);
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({ act: "pause:42" }),
        );
    });

    it("logs ready for any other state", () => {
        const logSpy = fireState(3);
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({ act: "ready" }),
        );
    });
});
