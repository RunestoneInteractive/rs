// Characterization tests for the SelectOne (selectquestion) component. These
// were first written against the jQuery implementation and now guard the
// jQuery-free version. renderComponent.js is replaced by a stub (see
// vitest.config.js), so rendering means "html lands in the target div".
// Note: deliberately NO jquery-globals import here -- selectquestion must
// work without jQuery.
import { describe, it, expect, beforeEach, vi } from "vitest";
import SelectOne from "../js/selectone.js";
import RunestoneBase from "../../common/js/runestonebase.js";

const MC_SRC =
    '<div data-component="multiplechoice" id="real_q_1"><p>Pick one.</p></div>';

function makeFixture({ id = "test_selq_1", attrs = "" } = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="selectquestion" id="${id}" ${attrs}></div>
      </div>`;
    return document.getElementById(id);
}

// Node's Request rejects relative URLs; fetch is mocked, so a capturing
// stand-in suffices.
class FakeRequest {
    constructor(url, opts = {}) {
        this.url = url;
        Object.assign(this, opts);
    }
}

// Route the component's fetches: get_question_source POSTs resolve with
// `source`, htmlsrc?acid=<id> GETs resolve from `toggleSrcs`.
function stubFetch({ source = MC_SRC, toggleSrcs = {} } = {}) {
    const fetchMock = vi.fn(async (request) => {
        let detail = source;
        const m = request.url.match(/htmlsrc\?acid=([\w-]+)/);
        if (m) {
            detail = toggleSrcs[m[1]];
        }
        return { ok: true, json: async () => ({ detail }) };
    });
    vi.stubGlobal("Request", FakeRequest);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

beforeEach(() => {
    document.body.innerHTML = "";
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("alert", vi.fn());
});

describe("constructor", () => {
    it("reads its configuration from data attributes with jQuery-style coercion", () => {
        const orig = makeFixture({
            attrs: `data-questionlist="q_a, q_b" data-points="3"
                    data-proficiency="loops" data-min-difficulty="2"
                    data-max-difficulty="4" data-autogradable="true"
                    data-not_seen_ever="true" data-primary="true"
                    data-ab="mainq" data-limit-basecourse="true"`,
        });
        const so = new SelectOne({ orig });
        expect(so.selector_id).toBe("test_selq_1");
        expect(so.questions).toBe("q_a, q_b");
        expect(so.points).toBe(3);
        expect(so.proficiency).toBe("loops");
        expect(so.minDifficulty).toBe(2);
        expect(so.maxDifficulty).toBe(4);
        expect(so.autogradable).toBe(true);
        expect(so.not_seen_ever).toBe(true);
        expect(so.primaryOnly).toBe(true);
        expect(so.ABExperiment).toBe("mainq");
        expect(so.limitBaseCourse).toBe(true);
    });
});

describe("initialize", () => {
    it("asks the server for a question and renders it in place", async () => {
        const fetchMock = stubFetch();
        const orig = makeFixture({
            attrs: 'data-questionlist="q_a, q_b" data-points="3"',
        });
        const so = new SelectOne({ orig });
        await so.initialize();
        const body = JSON.parse(fetchMock.mock.calls[0][0].body);
        expect(fetchMock.mock.calls[0][0].url).toContain(
            "/assessment/get_question_source",
        );
        expect(body.selector_id).toBe("test_selq_1");
        expect(body.questions).toBe("q_a, q_b");
        expect(body.points).toBe(3);
        expect(
            document.querySelector("#test_selq_1 #real_q_1"),
        ).not.toBe(null);
    });

    it("alerts and throws when the server has no matching question", async () => {
        stubFetch({ source: "No preview available for this question" });
        const orig = makeFixture();
        const so = new SelectOne({ orig });
        await expect(so.initialize()).rejects.toThrow(
            "Unable to find a question",
        );
        expect(alert).toHaveBeenCalledWith(
            expect.stringContaining("test_selq_1"),
        );
    });

    it("defers rendering to createTimedComponent inside a timed exam", async () => {
        stubFetch();
        const orig = makeFixture({ attrs: 'data-questionlist="q_a"' });
        const so = new SelectOne({ orig, timed: true, assessmentTaken: false });
        const rqaEntry = { question: so };
        so.origOpts.rqa = [rqaEntry];
        await so.initialize();
        // the placeholder in the timed assessment's question list is replaced
        expect(rqaEntry.question).not.toBe(so);
        expect(rqaEntry.question.htmlsrc).toBe(MC_SRC);
        expect(so.realComponent).toBe(rqaEntry.question);
        expect(so.realComponent.selectorId).toBe("test_selq_1");
        expect(so.containerDiv).toBe(rqaEntry.question.containerDiv);
    });
});

describe("page wiring", () => {
    it("initializes selectquestions at login-complete, skipping timed ones", async () => {
        stubFetch();
        document.body.innerHTML = `
          <div class="runestone">
            <div data-component="selectquestion" id="selq_free"
                 data-questionlist="q_a"></div>
          </div>
          <div data-component="timedAssessment">
            <div data-component="selectquestion" id="selq_timed"
                 data-questionlist="q_b"></div>
          </div>`;
        document.dispatchEvent(new CustomEvent("runestone:login-complete"));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.querySelector("#selq_free #real_q_1")).not.toBe(null);
        expect(
            document.querySelector("#selq_timed #real_q_1"),
        ).toBe(null);
    });
});

describe("toggle questions (assignment page)", () => {
    const PARSONS_SRC =
        '<div data-component="parsons" id="q_b"><p>Arrange.</p></div>';

    function makeToggleFixture() {
        stubFetch({
            source: '<div data-component="multiplechoice" id="q_a"></div>',
            toggleSrcs: {
                q_a: '<div data-component="multiplechoice" id="q_a"></div>',
                q_b: PARSONS_SRC,
            },
        });
        return makeFixture({
            attrs: 'data-questionlist="q_a, q_b" data-toggleoptions="toggle"',
        });
    }

    it("builds the toggle dropdown and hidden preview panel", async () => {
        const orig = makeToggleFixture();
        const so = new SelectOne({ orig });
        await so.initialize();
        const select = document.getElementById(
            "test_selq_1-toggleQuestion",
        );
        const options = [...select.options];
        expect(options.map((o) => o.value)).toEqual(["q_a", "q_b"]);
        expect(options[0].textContent).toContain("Multiple Choice - q_a");
        expect(options[1].textContent).toContain("Parsons Mixed-Up Code - q_b");
        expect(select.value).toBe("q_a");
        const preview = document.getElementById("component-preview");
        expect(preview.style.display).toBe("none");
        expect(
            document.getElementById("test_selq_1-toggleSelectedQuestion"),
        ).not.toBe(null);
    });

    it("previews the chosen question and can close the preview", async () => {
        const orig = makeToggleFixture();
        const so = new SelectOne({ orig });
        vi.spyOn(RunestoneBase.prototype, "logBookEvent").mockResolvedValue(
            undefined,
        );
        await so.initialize();
        const select = document.getElementById("test_selq_1-toggleQuestion");
        select.value = "q_b";
        select.dispatchEvent(new Event("change"));
        await new Promise((resolve) => setTimeout(resolve, 20));
        const preview = document.getElementById("component-preview");
        expect(preview.style.display).not.toBe("none");
        expect(
            document.querySelector("#toggle-preview [data-component=parsons]"),
        ).not.toBe(null);
        const buttons = [
            ...document.querySelectorAll("#toggle-buttons button"),
        ];
        expect(buttons.map((b) => b.textContent)).toEqual([
            "Close Preview",
            "Select this Problem",
        ]);
        buttons[0].click();
        expect(preview.style.display).toBe("none");
        expect(document.getElementById("toggle-preview").innerHTML).toBe("");
        expect(select.value).toBe("q_a");
    });
});
