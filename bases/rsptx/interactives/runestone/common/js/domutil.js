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

/**
 * Width of an element including margins, like jQuery's .outerWidth(true).
 */
export function outerWidth(element) {
    const style = getComputedStyle(element);
    return (
        element.getBoundingClientRect().width +
        (parseFloat(style.marginLeft) || 0) +
        (parseFloat(style.marginRight) || 0)
    );
}

/**
 * Height of an element including margins, like jQuery's .outerHeight(true).
 */
export function outerHeight(element) {
    const style = getComputedStyle(element);
    return (
        element.getBoundingClientRect().height +
        (parseFloat(style.marginTop) || 0) +
        (parseFloat(style.marginBottom) || 0)
    );
}

// Properties that take a bare number rather than a px length.
const unitless = new Set(["opacity", "zIndex", "fontWeight"]);

const kebab = /-([a-z])/g;
const camelCase = (name) => name.replace(kebab, (m, c) => c.toUpperCase());

function parseColor(value) {
    if (!value) return null;
    let m = value.match(/^#([0-9a-f]{3})$/i);
    if (m) {
        return [...m[1]].map((c) => parseInt(c + c, 16));
    }
    m = value.match(/^#([0-9a-f]{6})$/i);
    if (m) {
        return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    }
    m = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
        return [+m[1], +m[2], +m[3]];
    }
    return null;
}

/**
 * A requestAnimationFrame tween covering the subset of jQuery's .animate()
 * the components use: numeric CSS properties (px, or bare for opacity-like
 * properties) and colors, plus start/progress/complete callbacks. progress
 * receives the 0..1 fraction as its second argument, matching the jQuery
 * callback shape used by existing callers.
 */
export function animate(element, properties, options = {}) {
    const duration = options.duration ?? 400;
    const computed = getComputedStyle(element);
    const tweens = [];
    for (const [name, target] of Object.entries(properties)) {
        const prop = camelCase(name);
        if (typeof target === "number") {
            const from = parseFloat(computed[prop]) || 0;
            const unit = unitless.has(prop) ? "" : "px";
            tweens.push((p) => {
                element.style[prop] = from + (target - from) * p + unit;
            });
        } else {
            const fromColor = parseColor(computed[prop]);
            const toColor = parseColor(target);
            if (fromColor && toColor) {
                tweens.push((p) => {
                    const mixed = fromColor.map((f, i) =>
                        Math.round(f + (toColor[i] - f) * p),
                    );
                    element.style[prop] = `rgb(${mixed.join(", ")})`;
                });
            } else {
                // Not interpolatable; just apply the final value at the end.
                tweens.push((p) => {
                    if (p === 1) element.style[prop] = target;
                });
            }
        }
    }
    if (options.start) options.start();
    const t0 = performance.now();
    function step(now) {
        const p = Math.min(1, (now - t0) / duration);
        for (const tween of tweens) tween(p);
        if (options.progress) options.progress(null, p, null);
        if (p < 1) {
            requestAnimationFrame(step);
        } else if (options.complete) {
            options.complete();
        }
    }
    requestAnimationFrame(step);
}
