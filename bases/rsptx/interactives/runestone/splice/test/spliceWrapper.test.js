// Tests for the SPLICE wrapper's handling of iframes registered by the
// grading interface. A registered frame is replaying one student's saved
// attempt to an instructor, so it must be answered from that attempt and must
// never write anything back.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { SpliceWrapper } from "../js/spliceWrapper.ts";

// Build an iframe whose contentWindow is a stub we can use as event.source,
// which is how the wrapper identifies the sending frame.
function makeFrame(id) {
    const frame = document.createElement("iframe");
    frame.id = id;
    document.body.appendChild(frame);
    const source = { postMessage: vi.fn() };
    Object.defineProperty(frame, "contentWindow", { value: source });
    return { frame, source };
}

function post(data, source) {
    window.dispatchEvent(new MessageEvent("message", { data, source }));
}

// Let the wrapper's async message handler run.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SpliceWrapper grader frames", () => {
    let wrapper;

    beforeEach(() => {
        document.body.innerHTML = "";
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ detail: { answer: { who: "instructor" } } }),
            })
        );
        global.eBookConfig = { course: "testcourse" };
        wrapper = new SpliceWrapper();
        wrapper.logBookEvent = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("answers getState from the registered attempt instead of the server", async () => {
        const { frame, source } = makeFrame("graded-frame");
        const studentState = { who: "student", score: 3 };

        wrapper.registerGraderFrame(frame, studentState);
        post({ subject: "SPLICE.getState", message_id: "m1" }, source);
        await tick();

        expect(global.fetch).not.toHaveBeenCalled();
        expect(source.postMessage).toHaveBeenCalledWith(
            {
                message_id: "m1",
                subject: "SPLICE.getState.response",
                state: studentState,
            },
            "*"
        );
    });

    it("drops scores reported by a grader frame", async () => {
        const { frame, source } = makeFrame("graded-frame");
        wrapper.registerGraderFrame(frame, { who: "student" });

        post(
            {
                subject: "SPLICE.reportScoreAndState",
                score: 1,
                state: { poked: true },
            },
            source
        );
        await tick();

        expect(wrapper.logBookEvent).not.toHaveBeenCalled();
    });

    it("drops generic events raised by a grader frame", async () => {
        const { frame, source } = makeFrame("graded-frame");
        wrapper.registerGraderFrame(frame, {});

        post({ subject: "SPLICE.sendEvent", name: "clicked" }, source);
        await tick();

        expect(wrapper.logBookEvent).not.toHaveBeenCalled();
    });

    it("goes back to normal logging once the frame is unregistered", async () => {
        const { frame, source } = makeFrame("graded-frame");
        wrapper.registerGraderFrame(frame, { who: "student" });
        wrapper.unregisterGraderFrame(frame);

        post({ subject: "SPLICE.reportScoreAndState", score: 1, state: {} }, source);
        await tick();

        expect(wrapper.logBookEvent).toHaveBeenCalledTimes(1);
    });

    it("leaves unregistered frames on the normal server-backed path", async () => {
        const { source } = makeFrame("student-frame");

        post({ subject: "SPLICE.getState", message_id: "m2" }, source);
        await tick();

        expect(global.fetch).toHaveBeenCalled();
        expect(source.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ state: { who: "instructor" } }),
            "*"
        );
    });
});
