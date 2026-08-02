// Tests for the ClickableArea component, focused on the keyboard and screen
// reader affordances added for issue #1239.
// Note: deliberately NO jquery-globals import here -- clickable.js is
// jQuery-free.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ClickableArea from "../js/clickable.js";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// The Sphinx-rendered shape for a plain (non table) clickable: correct and
// incorrect choices are marked with data-correct / data-incorrect.
function makeFixture({ id = "test_ca_1" } = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="clickablearea" id="${id}">
          <span data-question>Q-1: Click the rainbow color(s)</span>
          <span data-feedback>This is incorrect</span>
          <pre><span data-correct>Red</span>
<span data-incorrect>Gold</span>
<span data-correct>Blue</span>
<span data-incorrect>Black</span></pre>
        </div>
      </div>`;
    return document.getElementById(id);
}

// The table shape: data-cc / data-ci give "row,cell" coordinates, where a cell
// of 0 means the whole row is clickable.
function makeTableFixture({ id = "test_ca_table" } = {}) {
    document.body.innerHTML = `
      <div class="runestone">
        <div data-component="clickablearea" id="${id}" data-table
             data-cc="1,0;3,1" data-ci="2,1">
          <span data-question>Q-2: Click the rainbow color(s)</span>
          <span data-feedback>This is incorrect</span>
          <table>
            <tbody>
              <tr><td>Red</td><td>Orange</td></tr>
              <tr><td>White</td><td>Green</td></tr>
              <tr><td>Blue</td><td>White</td></tr>
            </tbody>
          </table>
        </div>
      </div>`;
    return document.getElementById(id);
}

async function makeClickable(fixture = makeFixture) {
    const orig = fixture();
    const ca = new ClickableArea({ orig: orig, useRunestoneServices: false });
    await ca.component_ready_promise;
    await tick();
    return ca;
}

function press(el, key) {
    el.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: key, bubbles: true }),
    );
}

describe("ClickableArea accessibility", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        document.body.innerHTML = "";
        vi.restoreAllMocks();
    });

    it("exposes every clickable as a focusable checkbox", async () => {
        const ca = await makeClickable();
        expect(ca.clickableArray).toHaveLength(4);
        for (const el of ca.clickableArray) {
            expect(el.getAttribute("role")).toBe("checkbox");
            expect(el.getAttribute("tabindex")).toBe("0");
            expect(el.getAttribute("aria-checked")).toBe("false");
        }
    });

    it("names the group of choices with the question", async () => {
        const ca = await makeClickable();
        expect(ca.newDiv.getAttribute("role")).toBe("group");
        expect(ca.newDiv.getAttribute("aria-labelledby")).toBe(ca.question.id);
        expect(
            document.getElementById(ca.newDiv.getAttribute("aria-describedby"))
                .textContent,
        ).toMatch(/Tab key/);
    });

    it.each(["Enter", " "])("toggles a choice with the %s key", async (key) => {
        const ca = await makeClickable();
        const first = ca.clickableArray[0];

        press(first, key);
        expect(first.classList.contains("clickable-clicked")).toBe(true);
        expect(first.getAttribute("aria-checked")).toBe("true");
        expect(ca.isAnswered).toBe(true);

        press(first, key);
        expect(first.classList.contains("clickable-clicked")).toBe(false);
        expect(first.getAttribute("aria-checked")).toBe("false");
    });

    it("ignores keys that are not activation keys", async () => {
        const ca = await makeClickable();
        const first = ca.clickableArray[0];
        press(first, "a");
        press(first, "Tab");
        expect(first.getAttribute("aria-checked")).toBe("false");
    });

    it("keeps the space bar from scrolling the page", async () => {
        const ca = await makeClickable();
        const ev = new window.KeyboardEvent("keydown", {
            key: " ",
            bubbles: true,
            cancelable: true,
        });
        ca.clickableArray[0].dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
    });

    it("keeps aria-checked in sync when toggled by mouse", async () => {
        const ca = await makeClickable();
        const first = ca.clickableArray[0];
        first.click();
        expect(first.getAttribute("aria-checked")).toBe("true");
        first.click();
        expect(first.getAttribute("aria-checked")).toBe("false");
    });

    it("announces the running selection count", async () => {
        const ca = await makeClickable();
        expect(ca.liveRegion.getAttribute("aria-live")).toBe("polite");

        press(ca.clickableArray[0], "Enter");
        expect(ca.liveRegion.textContent).toBe("1 of 4 choices selected.");

        press(ca.clickableArray[2], "Enter");
        expect(ca.liveRegion.textContent).toBe("2 of 4 choices selected.");

        press(ca.clickableArray[0], "Enter");
        expect(ca.liveRegion.textContent).toBe("1 of 4 choices selected.");
    });

    it("announces the grading result politely", async () => {
        const ca = await makeClickable();
        expect(ca.feedBackDiv.getAttribute("aria-live")).toBe("polite");
    });

    it("marks wrongly selected choices as invalid, and clears the mark", async () => {
        const ca = await makeClickable();
        const wrong = ca.incorrectArray[0];
        press(wrong, "Enter");
        ca.checkCurrentAnswer();
        ca.renderFeedback();
        expect(wrong.getAttribute("aria-invalid")).toBe("true");

        // Unselecting it clears the mark right away
        press(wrong, "Enter");
        expect(wrong.hasAttribute("aria-invalid")).toBe(false);

        ca.checkCurrentAnswer();
        ca.renderFeedback();
        expect(wrong.hasAttribute("aria-invalid")).toBe(false);
    });

    it("restores stored answers with the matching checked state", async () => {
        const first = await makeClickable();
        press(first.clickableArray[1], "Enter");
        first.checkCurrentAnswer(); // writes local storage

        document.body.innerHTML = "";
        const restored = await makeClickable();
        expect(restored.clickableArray[1].classList).toContain(
            "clickable-clicked",
        );
        expect(restored.clickableArray[1].getAttribute("aria-checked")).toBe(
            "true",
        );
        expect(restored.clickableArray[0].getAttribute("aria-checked")).toBe(
            "false",
        );
    });

    it("takes disabled choices out of the tab order and stops toggling", async () => {
        const ca = await makeClickable();
        ca.disableInteraction();
        const first = ca.clickableArray[0];
        expect(first.getAttribute("tabindex")).toBe("-1");
        expect(first.getAttribute("aria-disabled")).toBe("true");

        press(first, "Enter");
        expect(first.getAttribute("aria-checked")).toBe("false");
        first.click();
        expect(first.getAttribute("aria-checked")).toBe("false");
    });

    it("makes table rows and cells reachable too", async () => {
        const ca = await makeClickable(makeTableFixture);
        expect(ca.clickableArray.length).toBeGreaterThan(0);
        expect(ca.clickableArray.map((el) => el.nodeName)).toContain("TR");
        for (const el of ca.clickableArray) {
            expect(el.getAttribute("role")).toBe("checkbox");
            expect(el.getAttribute("tabindex")).toBe("0");
        }
        press(ca.clickableArray[0], " ");
        expect(ca.clickableArray[0].getAttribute("aria-checked")).toBe("true");
    });
});
