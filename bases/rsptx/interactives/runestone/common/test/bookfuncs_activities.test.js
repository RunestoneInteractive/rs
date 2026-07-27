/**
 * Tests for the page-scanning fallback that counts activities for the progress
 * bar when the server sends no counts (i.e. nobody is logged in).
 *
 * See issue #990: eight PreTeXt multiple choice exercises were reported as one
 * activity because the markup puts an id-less `exercise-statement` div ahead of
 * the element carrying `data-component`.
 */
import { describe, it, expect, beforeEach } from "vitest";

import { countActivitiesInPage } from "../js/bookfuncs.js";

/** A PreTeXt multiple choice exercise, shaped like real csawesome2 output. */
function ptxMultipleChoice(id) {
    return `
<div class="ptx-runestone-container"><div class="runestone multiplechoice_section">
<div class="exercise-statement">
<div class="para" id="${id}-1-1">What does the following code print?</div>
</div>
<ul data-component="multiplechoice" class="exercise-interactives" id="${id}" data-multipleanswers="false">
<li data-component="answer" id="${id}_opt_a" data-correct="">
<div class="para">2</div>
</li>
<li data-component="feedback" id="${id}_opt_a">
<div class="para">3 goes into 2 zero times with a remainder of 2.</div>
</li>
<li data-component="answer" id="${id}_opt_b">
<div class="para">0</div>
</li>
</ul>
</div></div>`;
}

/** A component that is the first child of its wrapper, as Sphinx books emit. */
function sphinxActiveCode(id) {
    return `
<div class="runestone explainer ac_section">
<div data-component="activecode" id="${id}">
<textarea data-lang="python">print("hi")</textarea>
</div>
</div>`;
}

describe("countActivitiesInPage", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    it("counts the page itself when there are no activities", () => {
        expect(countActivitiesInPage()).toEqual({ page: 0 });
    });

    it("counts each PreTeXt multiple choice question separately", () => {
        document.body.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8]
            .map((n) => ptxMultipleChoice(`csawesome2__qve_${n}`))
            .join("\n");

        const activities = countActivitiesInPage();

        // eight questions plus the page pseudo-activity
        expect(Object.keys(activities)).toHaveLength(9);
        expect(activities).toHaveProperty("csawesome2__qve_1", 0);
        expect(activities).toHaveProperty("csawesome2__qve_8", 0);
    });

    it("keys on the component id, not on the answers nested inside it", () => {
        document.body.innerHTML = ptxMultipleChoice("csawesome2__qve_1");

        expect(Object.keys(countActivitiesInPage()).sort()).toEqual([
            "csawesome2__qve_1",
            "page",
        ]);
    });

    it("still finds components that are the first child of the wrapper", () => {
        document.body.innerHTML =
            sphinxActiveCode("ac_1") + sphinxActiveCode("ac_2");

        expect(Object.keys(countActivitiesInPage()).sort()).toEqual([
            "ac_1",
            "ac_2",
            "page",
        ]);
    });

    it("finds a component that is the wrapper itself", () => {
        document.body.innerHTML = `
<div class="runestone" data-component="shortanswer" id="sa_1">
<div class="journal">Write something.</div>
</div>`;

        expect(Object.keys(countActivitiesInPage()).sort()).toEqual([
            "page",
            "sa_1",
        ]);
    });

    it("gives activities with no usable id a key of their own", () => {
        document.body.innerHTML = `
<div class="runestone"><div class="exercise-statement"><p>no ids here</p></div></div>
<div class="runestone"><div class="exercise-statement"><p>none here either</p></div></div>`;

        // Two unidentifiable activities must not collapse into one key.
        expect(Object.keys(countActivitiesInPage())).toHaveLength(3);
    });
});
