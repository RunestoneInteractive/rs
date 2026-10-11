// Program output from Jobe (Java, C, C++) is student-controlled and must be
// escaped before it reaches innerHTML; the one exception is the base64
// data:image tag the books' Java image/turtle libraries print.
import { describe, it, expect } from "vitest";
import { errorTextToHtml, programOutputToHtml } from "../js/programOutput.js";
import JUnitTestParser from "../js/extractUnitResults-JUnit.js";
import DoctestTestParser from "../js/extractUnitResults-Doctest.js";

const PAYLOAD = `<img src=x onerror="alert(1)">`;
const PNG = "data:image/png;base64,iVBORw0KGgo=";

function render(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div;
}

describe("programOutputToHtml", () => {
    it("escapes markup in program output", () => {
        const div = render(programOutputToHtml(`hi ${PAYLOAD}\n`));
        expect(div.querySelector("img")).toBeNull();
        expect(div.textContent).toBe(`hi ${PAYLOAD}\n`);
    });

    it.each([
        [`&ltimg src="${PNG}"/>`],
        [`&lt;img src="${PNG}"/>`],
        [`<img src='${PNG}'>`],
    ])("keeps data:image output written as %s", (tag) => {
        const div = render(programOutputToHtml(`before\n${tag}\nafter`));
        const imgs = div.querySelectorAll("img");
        expect(imgs.length).toBe(1);
        expect(imgs[0].getAttribute("src")).toBe(PNG);
        expect(imgs[0].attributes.length).toBe(1);
        expect(div.textContent).toBe("before\n\nafter");
    });

    it("drops extra attributes on an otherwise valid image", () => {
        const div = render(
            programOutputToHtml(`<img src="${PNG}" onerror="alert(1)">`),
        );
        expect(div.querySelector("img")).toBeNull();
    });

    it("does not keep non-data or non-image sources", () => {
        for (const src of [
            "http://example.com/x.png",
            "javascript:alert(1)",
            "data:text/html;base64,PHNjcmlwdD4=",
        ]) {
            const div = render(programOutputToHtml(`<img src="${src}">`));
            expect(div.querySelector("img")).toBeNull();
        }
    });

    it("optionally converts newlines", () => {
        expect(programOutputToHtml("a\nb", { newlines: true })).toBe("a<br>b");
        expect(programOutputToHtml(undefined)).toBe("");
    });
});

describe("errorTextToHtml", () => {
    it("escapes compiler output that quotes student code", () => {
        const div = render(
            errorTextToHtml(`prog.java:3: error\n  String s = "${PAYLOAD}"`),
        );
        expect(div.querySelector("img")).toBeNull();
        expect(div.querySelectorAll("br").length).toBe(1);
    });
});

describe("JUnitTestParser", () => {
    const out = [
        "Starting Tests",
        `Expected: 1     Actual: ${PAYLOAD}     Message: Checking     Passed: false`,
        "Ending Tests",
        `printed ${PAYLOAD}`,
        `&ltimg src="${PNG}"/>`,
        "You got 0 out of 1 correct. 0.00%",
    ].join("\n");

    it("puts test fields in the table as text", () => {
        const p = new JUnitTestParser(out, "q1");
        expect(p.table.querySelector("img")).toBeNull();
        expect(p.table.textContent).toContain(PAYLOAD);
    });

    it("escapes stdout but keeps the turtle/image output", () => {
        const div = render(new JUnitTestParser(out, "q1").stdout);
        const imgs = div.querySelectorAll("img");
        expect(imgs.length).toBe(1);
        expect(imgs[0].getAttribute("src")).toBe(PNG);
        expect(div.textContent).toContain(`printed ${PAYLOAD}`);
    });
});

describe("DoctestTestParser", () => {
    it("escapes program output", () => {
        const sep = "=".repeat(79);
        const out = `[doctest] v\n[doctest] run\n${PAYLOAD}\n${sep}\n[doctest] assertions: 1 | 1 passed | 0 failed |\n`;
        const div = render(new DoctestTestParser(out, "q1").stdout);
        expect(div.querySelector("img")).toBeNull();
        expect(div.textContent).toContain(PAYLOAD);
    });
});
