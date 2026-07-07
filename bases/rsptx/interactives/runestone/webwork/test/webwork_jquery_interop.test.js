// The WeBWorK server's own JS fires runestone_ww_check / runestone_show_correct
// through the page's jQuery ($("body").trigger(name, payload)). webwork.js no
// longer needs jQuery itself, but it must still hear those triggers when the
// page provides jQuery. This file loads the jQuery shim ON PURPOSE to stand in
// for such a page -- do not copy this import into component tests.
import "../../../test-support/jquery-globals.js";
import { describe, it, expect, beforeEach, vi } from "vitest";
import "../js/webwork.js";
import RunestoneBase from "../../common/js/runestonebase.js";

const RIGHT = {
    score: 1,
    type: "Value (Formula)",
    original_student_ans: "x+1",
    student_value: "x+1(v)",
    correct_value: "x+1",
};

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="webwork" id="test_ww_1"></div>
      </div>`;
    window.componentMap = {};
    window.allComponents = [];
    window.wwList = {};
    localStorage.clear();
    vi.restoreAllMocks();
    eBookConfig.useRunestoneServices = true;
});

it("grades an answer delivered by a jQuery trigger", async () => {
    const ww = window.component_factory.webwork({
        orig: document.getElementById("test_ww_1"),
    });
    const logSpy = vi
        .spyOn(RunestoneBase.prototype, "logBookEvent")
        .mockResolvedValue(undefined);
    window
        .jQuery("body")
        .trigger("runestone_ww_check", {
            ww_version: "2.17",
            inputs_ref: { problemUUID: "test_ww_1-ww-rs" },
            rh_result: { answers: { AnSwEr0001: RIGHT } },
        });
    await tick();
    expect(ww.correct).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: "webwork" }),
    );
});

it("handles a native dispatch exactly once even with jQuery present", async () => {
    const ww = window.component_factory.webwork({
        orig: document.getElementById("test_ww_1"),
    });
    const processSpy = vi.spyOn(ww, "processCurrentAnswers");
    vi.spyOn(RunestoneBase.prototype, "logBookEvent").mockResolvedValue(
        undefined,
    );
    document.body.dispatchEvent(
        new CustomEvent("runestone_ww_check", {
            detail: {
                ww_version: "2.17",
                inputs_ref: { problemUUID: "test_ww_1-ww-rs" },
                rh_result: { answers: { AnSwEr0001: RIGHT } },
            },
            bubbles: true,
        }),
    );
    await tick();
    expect(processSpy).toHaveBeenCalledTimes(1);
});
