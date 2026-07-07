// Tests for the page-completion machinery in user-highlights.js. The jQuery
// version used jQuery.ajax (one call synchronous), which the test harness
// cannot reasonably stand in for, so these tests were derived by reading the
// jQuery flows and now guard the fetch-based version.
// Note: deliberately NO jquery-globals import here.
import { describe, it, expect, beforeEach, vi } from "vitest";
import "../js/user-highlights.js";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// Route fetches by URL substring. Endpoints answer JSON or the literal
// string "None", exactly like the server.
function stubFetch({ completionStatus = 0 } = {}) {
    const fetchMock = vi.fn(async (url) => {
        let body = "None";
        if (String(url).includes("getCompletionStatus")) {
            body =
                completionStatus === null
                    ? "None"
                    : JSON.stringify({
                          detail: [{ completionStatus }],
                      });
        } else if (String(url).includes("updatelastpage")) {
            body = JSON.stringify({ detail: "ok" });
        }
        return { ok: true, text: async () => body };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

async function login() {
    document.dispatchEvent(new Event("runestone:login"));
    await tick(5);
}

function updateCalls(fetchMock) {
    return fetchMock.mock.calls
        .filter(([url]) => String(url).includes("updatelastpage"))
        .map(([, opts]) => JSON.parse(opts.body));
}

beforeEach(() => {
    document.body.innerHTML = `<div id="scprogresscontainer"></div>`;
    document.body.classList.remove("pretext");
    vi.restoreAllMocks();
});

describe("completion button", () => {
    it("offers Mark as Completed for an unfinished page", async () => {
        const fetchMock = stubFetch({ completionStatus: 0 });
        await login();
        const button = document.getElementById("completionButton");
        expect(button.classList.contains("buttonAskCompletion")).toBe(true);
        expect(button.textContent).toBe("Mark as Completed");
        const statusUrl = String(fetchMock.mock.calls[0][0]);
        expect(statusUrl).toContain("/logger/getCompletionStatus");
        expect(statusUrl).toContain("lastPageUrl=%2F");
    });

    it("shows the completed state for a finished page", async () => {
        stubFetch({ completionStatus: 1 });
        await login();
        const button = document.getElementById("completionButton");
        expect(button.classList.contains("buttonConfirmCompletion")).toBe(
            true,
        );
        expect(button.textContent).toContain("Completed. Well Done!");
    });

    it("adds no button when the server has no completion record", async () => {
        stubFetch({ completionStatus: null });
        await login();
        expect(document.getElementById("completionButton")).toBe(null);
    });

    it("marks the page visited on load even without a button", async () => {
        const fetchMock = stubFetch({ completionStatus: null });
        await login();
        const updates = updateCalls(fetchMock);
        expect(updates.length).toBe(1);
        expect(updates[0]).toMatchObject({
            pageLoad: true,
            markingComplete: false,
            markingIncomplete: false,
            lastPageUrl: "/",
            course: "test_course",
        });
    });

    it("posts completion when clicked, and can undo it", async () => {
        const fetchMock = stubFetch({ completionStatus: 0 });
        await login();
        const button = document.getElementById("completionButton");
        button.click();
        await tick(5);
        expect(button.classList.contains("buttonConfirmCompletion")).toBe(
            true,
        );
        let updates = updateCalls(fetchMock);
        expect(updates[updates.length - 1]).toMatchObject({
            completionFlag: 1,
            pageLoad: false,
            markingComplete: true,
            markingIncomplete: false,
        });
        button.click();
        await tick(5);
        expect(button.classList.contains("buttonAskCompletion")).toBe(true);
        expect(button.textContent).toBe("Mark as Completed");
        updates = updateCalls(fetchMock);
        expect(updates[updates.length - 1]).toMatchObject({
            completionFlag: 0,
            markingComplete: false,
            markingIncomplete: true,
        });
    });
});
