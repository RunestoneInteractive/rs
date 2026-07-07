import { describe, it, expect } from "vitest";
import { getDataValue, toggleDisplay } from "../js/domutil.js";

function makeEl(attrs) {
    const el = document.createElement("div");
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }
    return el;
}

describe("getDataValue (jQuery .data() compatible coercion)", () => {
    it("returns undefined for missing attributes", () => {
        expect(getDataValue(makeEl({}), "lang")).toBeUndefined();
    });

    it("returns strings as-is", () => {
        expect(getDataValue(makeEl({ "data-lang": "python" }), "lang")).toBe(
            "python",
        );
    });

    it("coerces booleans and null", () => {
        expect(getDataValue(makeEl({ "data-x": "true" }), "x")).toBe(true);
        expect(getDataValue(makeEl({ "data-x": "false" }), "x")).toBe(false);
        expect(getDataValue(makeEl({ "data-x": "null" }), "x")).toBe(null);
    });

    it("coerces numbers only when lossless", () => {
        expect(getDataValue(makeEl({ "data-x": "30000" }), "x")).toBe(30000);
        expect(getDataValue(makeEl({ "data-x": "1.5" }), "x")).toBe(1.5);
        // leading zeros / version strings stay strings
        expect(getDataValue(makeEl({ "data-x": "007" }), "x")).toBe("007");
        expect(getDataValue(makeEl({ "data-x": "1.2.3" }), "x")).toBe("1.2.3");
    });

    it("parses JSON-looking values", () => {
        expect(getDataValue(makeEl({ "data-x": '{"a": 1}' }), "x")).toEqual({
            a: 1,
        });
        expect(getDataValue(makeEl({ "data-x": "[1, 2]" }), "x")).toEqual([
            1, 2,
        ]);
    });

    it("keeps hyphenated and underscored attribute names verbatim", () => {
        const el = makeEl({
            "data-highlight-lines": "1-3",
            "data-question_label": "1.2",
        });
        expect(getDataValue(el, "highlight-lines")).toBe("1-3");
        expect(getDataValue(el, "question_label")).toBe(1.2);
    });

    it("empty string attribute is truthy-adjacent like jQuery (empty string)", () => {
        expect(getDataValue(makeEl({ "data-x": "" }), "x")).toBe("");
    });
});

describe("toggleDisplay", () => {
    it("hides a visible element and shows it again", () => {
        const el = document.createElement("div");
        document.body.appendChild(el);
        toggleDisplay(el);
        expect(el.style.display).toBe("none");
        toggleDisplay(el);
        expect(el.style.display).not.toBe("none");
        el.remove();
    });

    it("ignores null elements", () => {
        expect(() => toggleDisplay(null)).not.toThrow();
    });
});
