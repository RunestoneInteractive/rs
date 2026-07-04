// Characterization tests for the GroupSub component. These were first
// written against the jQuery implementation and now guard the jQuery-free
// version (which drops the select2 enhancement and uses the underlying
// native multi-select).
// Note: deliberately NO jquery-globals import here -- groupsub must work
// without jQuery.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GroupSub } from "../js/groupsub.js";
import RunestoneBase from "../../common/js/runestonebase.js";

// The assignment page (doAssignment.html) provides the button container and
// the multi-select the component fills in.
function makeFixture({ id = "test_gs_1", limit = 4 } = {}) {
    document.body.innerHTML = `
      <div data-component="groupsub" id="${id}" data-size_limit="${limit}">
        <div id="groupsub_button"></div>
        <select id="assignment_group" multiple class="assignment_partner_select"></select>
      </div>`;
    return document.getElementById(id);
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function makeGroupSub(fixtureOpts = {}) {
    const orig = makeFixture(fixtureOpts);
    const gs = new GroupSub({ orig });
    await gs.initialize();
    return gs;
}

function select(gs, ...sids) {
    for (const option of gs.picker.options) {
        if (sids.includes(option.value)) {
            option.selected = true;
        }
    }
}

beforeEach(() => {
    document.body.innerHTML = "";
    document.body.classList.remove("pretext");
    window.componentMap = {};
    window.allComponents = [];
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("alert", vi.fn());
    eBookConfig.username = "leader";
});

afterEach(() => {
    delete eBookConfig.username;
});

describe("construction and initialize", () => {
    it("adds a Submit Group button to the page's button container", async () => {
        await makeGroupSub();
        const button = document.querySelector("#groupsub_button button");
        expect(button.textContent).toBe("Submit Group");
        expect(button.classList.contains("btn-success")).toBe(true);
    });

    it("fills the picker with the demo class list when services are off", async () => {
        const gs = await makeGroupSub();
        expect(gs.picker).toBe(document.getElementById("assignment_group"));
        const values = [...gs.picker.options].map((o) => o.value);
        expect(values).toEqual(["s1", "s2", "s3", "s4", "s5"]);
        expect(gs.picker.options[0].textContent).toBe("User 1");
    });

    // Node's Request rejects the relative URLs the component uses; fetch is
    // mocked in these tests, so a capturing stand-in is enough.
    class FakeRequest {
        constructor(url, opts) {
            this.url = url;
            Object.assign(this, opts);
        }
    }

    it("fills the picker from the course roster when services are on", async () => {
        eBookConfig.useRunestoneServices = true;
        vi.stubGlobal("Request", FakeRequest);
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                redirected: false,
                json: async () => ({
                    detail: {
                        students: { alice: "Alice A", bob: "Bob B" },
                    },
                }),
            }),
        );
        try {
            const gs = await makeGroupSub();
            const values = [...gs.picker.options].map((o) => o.value);
            expect(values).toEqual(["alice", "bob"]);
        } finally {
            eBookConfig.useRunestoneServices = false;
        }
    });

    it("degrades to an explanatory entry when the roster fetch fails", async () => {
        eBookConfig.useRunestoneServices = true;
        vi.stubGlobal("Request", FakeRequest);
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: false, redirected: false }),
        );
        try {
            const gs = await makeGroupSub();
            expect([...gs.picker.options][0].textContent).toContain(
                "Failed to load students",
            );
        } finally {
            eBookConfig.useRunestoneServices = false;
        }
    });
});

describe("submitAll", () => {
    it("submits every component on the page for every group member", async () => {
        const gs = await makeGroupSub();
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        const question = {
            logCurrentAnswer: vi.fn().mockResolvedValue(undefined),
        };
        window.allComponents = [question];
        select(gs, "s1", "s2");
        await gs.submitAll();
        // once per (member, question); the leader is added automatically
        const students = question.logCurrentAnswer.mock.calls.map(
            (c) => c[0],
        );
        expect(students).toEqual(["s1", "s2", "leader"]);
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "group_start",
                act: "s1,s2,leader",
            }),
        );
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "group_end",
                act: "s1,s2,leader",
            }),
        );
    });

    it("keeps submitting other members when one submission fails", async () => {
        const gs = await makeGroupSub();
        vi.spyOn(RunestoneBase.prototype, "logBookEvent").mockResolvedValue(
            undefined,
        );
        const bad = {
            logCurrentAnswer: vi.fn().mockRejectedValue(new Error("boom")),
        };
        const good = {
            logCurrentAnswer: vi.fn().mockResolvedValue(undefined),
        };
        window.allComponents = [bad, good];
        select(gs, "s1");
        await gs.submitAll();
        expect(good.logCurrentAnswer).toHaveBeenCalledTimes(2); // s1 + leader
    });

    it("refuses a group larger than the size limit", async () => {
        const gs = await makeGroupSub({ limit: 2 });
        const logSpy = vi
            .spyOn(RunestoneBase.prototype, "logBookEvent")
            .mockResolvedValue(undefined);
        select(gs, "s1", "s2", "s3");
        await gs.submitAll();
        expect(alert).toHaveBeenCalledWith(
            expect.stringContaining("You may not have more than 2"),
        );
        expect(logSpy).not.toHaveBeenCalled();
    });
});

describe("pretext pages", () => {
    it("scopes the button and picker to the component element", async () => {
        document.body.classList.add("pretext");
        document.body.innerHTML = `
          <section class="groupwork">
            <div data-component="groupsub" id="gs_ptx" data-size_limit="4">
              <div class="groupsub_button"></div>
              <select multiple class="assignment_partner_select"></select>
            </div>
          </section>`;
        const gs = new GroupSub({
            orig: document.getElementById("gs_ptx"),
        });
        await gs.initialize();
        expect(
            document.querySelector("#gs_ptx .groupsub_button button")
                .textContent,
        ).toBe("Submit Group");
        expect(gs.picker).toBe(
            document.querySelector("#gs_ptx .assignment_partner_select"),
        );
    });
});
