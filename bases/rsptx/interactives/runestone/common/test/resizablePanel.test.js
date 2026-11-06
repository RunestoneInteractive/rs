import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeResizablePanel } from "../js/resizablePanel.js";

const STORAGE_KEY = "rs-popup-panel-width";

function makePanel(right = 1000, width = 400) {
    const panel = document.createElement("div");
    panel.innerHTML = "<p>content</p>";
    document.body.appendChild(panel);
    // jsdom has no layout, so report the geometry the width would produce.
    vi.spyOn(panel, "getBoundingClientRect").mockImplementation(() => {
        const current = parseInt(panel.style.width, 10) || width;
        return {
            right,
            width: current,
            left: right - current,
            top: 0,
            height: 500,
        };
    });
    return panel;
}

function fire(target, type, clientX) {
    target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }));
}

describe("makeResizablePanel", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        localStorage.removeItem(STORAGE_KEY);
        window.innerWidth = 1000;
    });

    it("adds one handle and leaves the default width alone", () => {
        const panel = makePanel();
        makeResizablePanel(panel);
        makeResizablePanel(panel);
        const handles = panel.querySelectorAll(".rs-panel-resize-handle");
        expect(handles.length).toBe(1);
        expect(handles[0].getAttribute("role")).toBe("separator");
        expect(panel.style.width).toBe("");
    });

    it("widens as the left edge is dragged left and remembers the width", () => {
        const panel = makePanel();
        makeResizablePanel(panel);
        const handle = panel.querySelector(".rs-panel-resize-handle");
        fire(handle, "pointerdown", 600);
        fire(handle, "pointermove", 300);
        expect(panel.style.width).toBe("700px");
        expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
        fire(handle, "pointerup", 300);
        expect(localStorage.getItem(STORAGE_KEY)).toBe("700");
        // Moves after the drag has ended are ignored.
        fire(handle, "pointermove", 800);
        expect(panel.style.width).toBe("700px");
    });

    it("labels the handle and keeps the grab point under the pointer", () => {
        const panel = makePanel();
        makeResizablePanel(panel);
        const handle = panel.querySelector(".rs-panel-resize-handle");
        expect(handle.dataset.tooltip).toBe("Drag to resize");
        expect(handle.getAttribute("aria-label")).toBe("Resize panel");
        // Grabbed 10px left of the edge, which is at x=600.
        fire(handle, "pointerdown", 590);
        expect(handle.classList.contains("rs-dragging")).toBe(true);
        fire(handle, "pointermove", 590);
        expect(panel.style.width).toBe("400px");
        fire(handle, "pointermove", 490);
        expect(panel.style.width).toBe("500px");
        fire(handle, "pointerup", 490);
        expect(handle.classList.contains("rs-dragging")).toBe(false);
    });

    it("keeps the width between the minimum and the window", () => {
        const panel = makePanel();
        makeResizablePanel(panel);
        const handle = panel.querySelector(".rs-panel-resize-handle");
        fire(handle, "pointerdown", 600);
        fire(handle, "pointermove", 990);
        expect(panel.style.width).toBe("320px");
        fire(handle, "pointermove", -500);
        expect(panel.style.width).toBe("960px");
    });

    it("resizes with the arrow keys", () => {
        const panel = makePanel();
        makeResizablePanel(panel);
        const handle = panel.querySelector(".rs-panel-resize-handle");
        handle.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowLeft" }),
        );
        expect(panel.style.width).toBe("440px");
        handle.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowRight" }),
        );
        expect(panel.style.width).toBe("400px");
        expect(handle.getAttribute("aria-valuenow")).toBe("400");
    });

    it("restores a saved width, clamped to the current window", () => {
        localStorage.setItem(STORAGE_KEY, "5000");
        const panel = makePanel();
        makeResizablePanel(panel);
        expect(panel.style.width).toBe("960px");
    });
});
