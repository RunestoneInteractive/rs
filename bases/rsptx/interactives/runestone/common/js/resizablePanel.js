// Lets a student drag the left edge of a popup panel pinned to the right of the
// window (CodeTailor help, toggle previews). Parsons regions are inline-blocks, so
// a wide enough panel puts the source blocks beside the answer area instead of
// above it. The width is shared across problems and remembered between visits.
import { t } from "./rsi18n.js";
import "./resizablepanel-i18n.en.js";
import "../css/resizablepanel.css";

const STORAGE_KEY = "rs-popup-panel-width";
const MIN_WIDTH = 320;
const KEY_STEP = 40;
// Leaves room for the panel's 20px right margin and for the handle on its left.
const VIEWPORT_GAP = 40;
// How much of the handle sits outside the panel's left edge.
const HANDLE_OUTSIDE = 18;
// Below this, a tooltip to the left of the panel would run off the screen.
const TOOLTIP_ROOM = 140;

function maxWidth() {
    return Math.max(MIN_WIDTH, window.innerWidth - VIEWPORT_GAP);
}

function readSavedWidth() {
    try {
        return parseInt(localStorage.getItem(STORAGE_KEY), 10) || null;
    } catch {
        return null;
    }
}

function saveWidth(width) {
    try {
        localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
        // Storage can be unavailable; the panel just won't remember its width.
    }
}

export function makeResizablePanel(panel) {
    if (panel.querySelector(":scope > .rs-panel-resize-handle")) {
        return;
    }
    panel.classList.add("rs-resizable-panel");

    const handle = document.createElement("div");
    handle.classList.add("rs-panel-resize-handle");
    handle.tabIndex = 0;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", t("msg_resizablepanel_label"));
    handle.dataset.tooltip = t("msg_resizablepanel_tooltip");
    handle.setAttribute("aria-valuemin", String(MIN_WIDTH));
    panel.prepend(handle);

    const setWidth = (requested) => {
        const width = Math.round(
            Math.min(maxWidth(), Math.max(MIN_WIDTH, requested)),
        );
        panel.style.width = `${width}px`;
        // Overrides any percentage cap from a grid class such as col-md-6, and
        // keeps the panel on screen if the window later shrinks.
        panel.style.maxWidth = `calc(100vw - ${VIEWPORT_GAP}px)`;
        handle.setAttribute("aria-valuenow", String(width));
        handle.setAttribute("aria-valuemax", String(maxWidth()));
        return width;
    };

    // The handle is position: fixed so it stays put while the panel's content
    // scrolls, which means it has to follow the panel's edge itself.
    const placeHandle = () => {
        const rect = panel.getBoundingClientRect();
        handle.style.left = `${rect.left - HANDLE_OUTSIDE}px`;
        handle.style.top = `${rect.top}px`;
        handle.style.height = `${rect.height}px`;
        handle.classList.toggle("rs-tooltip-inside", rect.left < TOOLTIP_ROOM);
    };

    handle.addEventListener("pointerdown", (downEvent) => {
        downEvent.preventDefault();
        handle.setPointerCapture?.(downEvent.pointerId);
        handle.classList.add("rs-dragging");
        const start = panel.getBoundingClientRect();
        // The tab sits beside the edge, so keep the edge the same distance from
        // the pointer rather than jumping to it on the first move.
        const grabOffset = downEvent.clientX - start.left;
        let width = start.width;
        const onMove = (moveEvent) => {
            width = setWidth(start.right - (moveEvent.clientX - grabOffset));
        };
        const onEnd = () => {
            handle.classList.remove("rs-dragging");
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onEnd);
            handle.removeEventListener("pointercancel", onEnd);
            saveWidth(width);
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onEnd);
        handle.addEventListener("pointercancel", onEnd);
    });

    handle.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
        }
        event.preventDefault();
        const step = event.key === "ArrowLeft" ? KEY_STEP : -KEY_STEP;
        saveWidth(setWidth(panel.getBoundingClientRect().width + step));
    });

    const saved = readSavedWidth();
    if (saved) {
        setWidth(saved);
    }

    window.addEventListener("resize", placeHandle);
    if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(placeHandle).observe(panel);
    }
    placeHandle();
}
