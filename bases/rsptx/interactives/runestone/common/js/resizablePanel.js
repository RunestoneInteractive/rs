// Lets a student drag a tab on the left edge of a popup panel pinned to the right
// of the window (CodeTailor help, toggle previews). Parsons regions are
// inline-blocks, so a wide enough panel puts the source blocks beside the answer
// area instead of above it. The width is shared across problems and remembered
// between visits.
import { t } from "./rsi18n.js";
import "./resizablepanel-i18n.en.js";
import "../css/resizablepanel.css";

const STORAGE_KEY = "rs-popup-panel-width";
const MIN_WIDTH = 320;
const KEY_STEP = 40;
// Leaves room for the panel's 20px right margin and for the tab on its left.
const VIEWPORT_GAP = 40;
// Below this, a tooltip to the left of the panel would run off the screen.
const TOOLTIP_ROOM = 140;
// A press that moves less than this is a click, not a resize.
const DRAG_THRESHOLD = 3;

function widthLimits() {
    // Matches the CSS cap set in setWidth. On a window narrower than the minimum,
    // the window wins.
    const max = window.innerWidth - VIEWPORT_GAP;
    return { min: Math.min(MIN_WIDTH, max), max };
}

function clampWidth(requested) {
    const { min, max } = widthLimits();
    return Math.round(Math.min(max, Math.max(min, requested)));
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
    // Inline so it outranks a cached copy of an older stylesheet that makes the panel
    // itself scroll, which would clip the tab.
    panel.style.overflow = "visible";

    // The panel itself doesn't scroll, so the tab can sit on its edge in plain CSS
    // and stay put while the content moves.
    const scroller = document.createElement("div");
    scroller.classList.add("rs-panel-scroll");
    scroller.append(...panel.childNodes);
    panel.append(scroller);

    const handle = document.createElement("div");
    handle.classList.add("rs-panel-resize-handle");
    handle.tabIndex = 0;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", t("msg_resizablepanel_label"));
    handle.dataset.tooltip = t("msg_resizablepanel_tooltip");
    panel.prepend(handle);

    const describeWidth = (width) => {
        const { min, max } = widthLimits();
        handle.setAttribute("aria-valuemin", String(min));
        handle.setAttribute("aria-valuemax", String(max));
        handle.setAttribute("aria-valuenow", String(clampWidth(width)));
    };

    const setWidth = (requested) => {
        const width = clampWidth(requested);
        panel.style.width = `${width}px`;
        // Overrides any percentage cap from a grid class such as col-md-6, and
        // keeps the panel on screen if the window later shrinks.
        panel.style.maxWidth = `calc(100vw - ${VIEWPORT_GAP}px)`;
        describeWidth(width);
        return width;
    };

    // The panel can change size on its own (content, window), so catch up
    // whenever someone is about to use or read the handle.
    const refreshHandle = () => {
        const rect = panel.getBoundingClientRect();
        describeWidth(rect.width);
        handle.classList.toggle("rs-tooltip-inside", rect.left < TOOLTIP_ROOM);
    };
    handle.addEventListener("pointerenter", refreshHandle);
    handle.addEventListener("focus", refreshHandle);

    handle.addEventListener("pointerdown", (downEvent) => {
        if (downEvent.button !== 0) {
            return;
        }
        downEvent.preventDefault();
        handle.setPointerCapture?.(downEvent.pointerId);
        handle.classList.add("rs-dragging");
        const start = panel.getBoundingClientRect();
        // The tab sits beside the edge, so keep the edge the same distance from
        // the pointer rather than jumping to it on the first move.
        const grabOffset = downEvent.clientX - start.left;
        let width = null;
        const onMove = (moveEvent) => {
            const moved = Math.abs(moveEvent.clientX - downEvent.clientX);
            if (width === null && moved < DRAG_THRESHOLD) {
                return;
            }
            width = setWidth(start.right - (moveEvent.clientX - grabOffset));
        };
        const onEnd = () => {
            handle.classList.remove("rs-dragging");
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onEnd);
            handle.removeEventListener("pointercancel", onEnd);
            handle.removeEventListener("lostpointercapture", onEnd);
            if (width !== null) {
                saveWidth(width);
            }
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onEnd);
        handle.addEventListener("pointercancel", onEnd);
        handle.addEventListener("lostpointercapture", onEnd);
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
    } else {
        refreshHandle();
    }
}
