/* ***********************************
 * |docname| - small DOM helpers
 * ***********************************
 * Helpers that replace common jQuery idioms as components are migrated to
 * plain DOM APIs.
 */

const rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/;

/**
 * Read a data-* attribute with the same type coercion jQuery's .data()
 * performed: "true"/"false"/"null" become their JS values, numeric strings
 * become numbers, JSON-looking strings are parsed, everything else is
 * returned as a string. Returns undefined when the attribute is absent.
 *
 * @param {Element} element
 * @param {string} name - the part of the attribute name after "data-"
 */
export function getDataValue(element, name) {
    const data = element.getAttribute(`data-${name}`);
    if (data === null) {
        return undefined;
    }
    if (data === "true") return true;
    if (data === "false") return false;
    if (data === "null") return null;
    // Only convert to a number if it doesn't change the string.
    if (data === +data + "") return +data;
    if (rbrace.test(data)) {
        try {
            return JSON.parse(data);
        } catch (e) {
            return data;
        }
    }
    return data;
}

/**
 * Show or hide an element by toggling inline display, like jQuery's .toggle().
 */
export function toggleDisplay(element) {
    if (!element) return;
    if (isHidden(element)) {
        element.style.display = "";
        if (isHidden(element)) {
            element.style.display = "block";
        }
    } else {
        element.style.display = "none";
    }
}

function isHidden(element) {
    if (element.style.display === "none") return true;
    const win = element.ownerDocument.defaultView;
    return win.getComputedStyle(element).display === "none";
}
