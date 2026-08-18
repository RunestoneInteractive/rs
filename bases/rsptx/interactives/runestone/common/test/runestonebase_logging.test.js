/**
 * Tests for postLogMessage's handling of the server's reply.
 *
 * See issue #1393: /logger/bookevent returns its payload under `detail`, but
 * only graded events put a score spec there. Ungraded events (view_toggle,
 * selectquestion, parsonsMove, ...) used to return a bare {timestamp}, which is
 * truthy, so the client ran its score-update code against it and threw
 * "Cannot set properties of null (setting 'innerHTML')". Because the DOM update
 * shared a try block with the fetch, the TypeError surfaced to the student as
 * "Error: Your action was not saved!" -- on a 201, after a successful save.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import RunestoneBase from "../js/runestonebase.js";

/** The score/message markup doAssignment.html renders per question. */
function assignmentMarkup(name) {
    document.body.innerHTML = `
<div id="${name}_score"><span class="qscore">0</span> / <span class="qmaxscore">2</span></div>
<div id="${name}_message"></div>`;
}

/** A RunestoneBase wired up the way a component on an assignment page is. */
function makeComponent(fields = {}) {
    let rb = new RunestoneBase();
    rb.jsonHeaders = new Headers({ "Content-type": "application/json" });
    rb.isTimed = false;
    Object.assign(rb, fields);
    return rb;
}

/** Stub a 201 reply carrying `detail`. */
function reply(detail) {
    globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ detail }),
    });
}

describe("postLogMessage", () => {
    let alertSpy, errorSpy;

    beforeEach(() => {
        eBookConfig.useRunestoneServices = true;
        // Node's Request needs an absolute URL; a book page has a real origin.
        eBookConfig.new_server_prefix = "http://localhost/ns";
        alertSpy = vi.spyOn(globalThis, "alert").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        eBookConfig.useRunestoneServices = false;
        eBookConfig.new_server_prefix = "/ns";
        vi.restoreAllMocks();
        document.body.innerHTML = "";
    });

    it("does not alert when an ungraded event returns no detail", async () => {
        assignmentMarkup("turtle_draw_F_sq");
        reply(null);
        let rb = makeComponent({
            divid: "turtle_draw_F_sq",
            selector_id: "turtle_draw_F_sq",
        });

        await rb.postLogMessage({
            event: "view_toggle",
            act: "turtle_draw_F_pp",
        });

        expect(alertSpy).not.toHaveBeenCalled();
    });

    it("ignores a bare timestamp from an older server", async () => {
        // Before the server learned to send `detail: null`, ungraded events came
        // back as {timestamp}. That is truthy but is not a score spec, and it is
        // what a book still pointed at an older server will receive.
        assignmentMarkup("turtle_draw_F_sq");
        reply({ timestamp: "2026-08-18T17:48:43.390620" });
        let rb = makeComponent({
            divid: "turtle_draw_F_sq",
            selector_id: "turtle_draw_F_sq",
        });

        await rb.postLogMessage({
            event: "view_toggle",
            act: "turtle_draw_F_pp",
        });

        expect(alertSpy).not.toHaveBeenCalled();
        // the score display is left exactly as the page rendered it
        expect(document.querySelector(".qscore").innerHTML).toBe("0");
        expect(
            document.getElementById("turtle_draw_F_sq_message").innerHTML,
        ).toBe("");
    });

    it("updates the score when a real score spec comes back", async () => {
        assignmentMarkup("ch1_q1");
        reply({ timestamp: "2026-08-18T17:48:43", assigned: true, score: 1.5 });
        let rb = makeComponent({ divid: "ch1_q1" });

        await rb.postLogMessage({ event: "mChoice", act: "answer:A:correct" });

        expect(alertSpy).not.toHaveBeenCalled();
        expect(document.querySelector(".qscore").innerHTML).toBe("1.5");
        expect(document.getElementById("total_score")).toBeNull();
    });

    it("reports closed submissions without crashing when there is no message div", async () => {
        // A select question names its message div after the selector, not after
        // the rendered question, so the inner component's `${divid}_message`
        // does not exist.
        document.body.innerHTML = `<div id="turtle_draw_F_sq_score">
            <span class="qscore">0</span> / <span class="qmaxscore">2</span></div>`;
        reply({
            timestamp: "2026-08-18T17:48:43",
            assigned: false,
            score: null,
        });
        let rb = makeComponent({
            divid: "turtle_draw_F_pp",
            selector_id: "turtle_draw_F_sq",
        });

        await rb.postLogMessage({ event: "parsons", act: "answer" });

        expect(alertSpy).not.toHaveBeenCalled();
    });

    it("does not claim the save failed when the score update throws", async () => {
        assignmentMarkup("ch1_q1");
        reply({ timestamp: "2026-08-18T17:48:43", assigned: true, score: 1 });
        let rb = makeComponent({ divid: "ch1_q1" });
        rb.updateScores = () => {
            throw new TypeError("boom");
        };

        await rb.postLogMessage({ event: "mChoice", act: "answer:A:correct" });

        expect(alertSpy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled();
    });

    it("still alerts when the save really fails", async () => {
        assignmentMarkup("ch1_q1");
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ detail: "boom" }),
        });
        let rb = makeComponent({ divid: "ch1_q1" });

        await rb.postLogMessage({ event: "mChoice", act: "answer:A:correct" });

        expect(alertSpy).toHaveBeenCalledOnce();
        expect(alertSpy.mock.calls[0][0]).toContain("was not saved");
    });

    it("alerts without throwing when fetch itself rejects", async () => {
        // `response` is never assigned in this case; reading response.status
        // used to throw a second error inside the error handler.
        assignmentMarkup("ch1_q1");
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));
        let rb = makeComponent({ divid: "ch1_q1" });

        await rb.postLogMessage({ event: "mChoice", act: "answer:A:correct" });

        expect(alertSpy).toHaveBeenCalledOnce();
        expect(alertSpy.mock.calls[0][0]).toContain("offline");
    });
});
