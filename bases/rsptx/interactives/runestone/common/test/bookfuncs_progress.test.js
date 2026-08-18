/**
 * Tests for the page progress bar: which pages get one, and what the counts
 * beside it report.
 *
 * See issue #613: the Book Index page (genindex.html) still showed a progress
 * bar, because the list of navigation pages here had drifted apart from the
 * copies in user-highlights.js and the sphinx progress template.
 *
 * The page itself is one of the counted activities: it is what lets a page with
 * no exercises on it still be completed, and it is included in the totals shown
 * beside the bar. That is the behaviour readers and instructors asked for, and
 * these tests pin it down -- it reverses the earlier reading of issue #614.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

import {
    isNonContentPage,
    NON_CONTENT_PAGES,
    PageProgressBar,
} from "../js/bookfuncs.js";

/** The markup a book emits for the progress bar. */
function progressMarkup() {
    return `
<div id="scprogresscontainer">You have attempted
<span id="scprogresstotal"></span> of <span id="scprogressposs"></span>
activities on this page.
<div id="subchapterprogress" aria-label="Page progress"></div>
</div>`;
}

const attempted = () => document.getElementById("scprogresstotal").textContent;
const possible = () => document.getElementById("scprogressposs").textContent;

/**
 * Build a bar whose reading score reporting is stubbed, so tests can assert
 * exactly when the score would be sent.
 */
function barWithSpy(activities, assignment_spec) {
    const sent = vi.fn().mockResolvedValue(undefined);
    const spec = { ...activities };
    if (assignment_spec !== undefined) {
        spec.assignment_spec = assignment_spec;
    }
    class Bar extends PageProgressBar {
        sendCompletedReadingScore() {
            sent();
            return Promise.resolve();
        }
    }
    return { bar: new Bar(spec), sent };
}

describe("reading score threshold", () => {
    beforeEach(() => {
        document.body.innerHTML = progressMarkup();
        window.eBookConfig = { isLoggedIn: true };
    });

    it("does not send the score before the required activities are done", () => {
        // The page is one of the counted activities, so a requirement of three
        // is page + two exercises. One exercise short of that must not send.
        const { sent } = barWithSpy(
            { page: 0, q1: 1, q2: 0, q3: 0 },
            { activities_required: 3 },
        );

        expect(sent).not.toHaveBeenCalled();
    });

    it("counts the page toward the requirement", () => {
        // Page read plus two exercises meets a requirement of three.
        const { sent } = barWithSpy(
            { page: 0, q1: 1, q2: 1, q3: 0 },
            { activities_required: 3 },
        );

        expect(sent).toHaveBeenCalled();
    });

    it("sends the score once the required activities are done", () => {
        const { sent } = barWithSpy(
            { q1: 1, q2: 1, q3: 1 },
            { activities_required: 3 },
        );

        expect(sent).toHaveBeenCalled();
    });

    it("sends the score when nothing specific is required", () => {
        // activities_required null means reading the page is enough.
        const { sent } = barWithSpy(
            { q1: 0, q2: 0, q3: 0 },
            { activities_required: null },
        );

        expect(sent).toHaveBeenCalled();
    });

    it("sends the score on a page that has no activities at all", () => {
        const { sent } = barWithSpy({}, { activities_required: null });

        expect(sent).toHaveBeenCalled();
    });

    it("records the page's activity count when none was specified", () => {
        const { bar } = barWithSpy(
            { q1: 0, q2: 0, q3: 0 },
            { activities_required: null },
        );

        // updateProgress() compares against this later. It is the same total the
        // reader sees beside the bar, so it includes the page.
        expect(bar.assignment_spec.activities_required).toBe(4);
    });

    it("sends the score from updateProgress on the last required activity", () => {
        // Requirement of three = the page plus both exercises.
        const { bar, sent } = barWithSpy(
            { page: 0, q1: 0, q2: 0 },
            { activities_required: 3 },
        );
        expect(sent).not.toHaveBeenCalled();

        bar.updateProgress("q1");
        expect(sent).not.toHaveBeenCalled();

        bar.updateProgress("q2");
        expect(sent).toHaveBeenCalled();
    });
});

describe("isNonContentPage", () => {
    it("treats the Book Index as a navigation page (#613)", () => {
        expect(isNonContentPage("/books/published/foo/genindex.html")).toBe(
            true,
        );
    });

    it("covers every page in the shared list", () => {
        for (const page of NON_CONTENT_PAGES) {
            expect(isNonContentPage(`/books/published/foo/${page}`)).toBe(true);
        }
    });

    it("leaves ordinary content pages alone", () => {
        expect(isNonContentPage("/books/published/foo/functions.html")).toBe(
            false,
        );
    });

    it("matches the whole file name, not a substring of it", () => {
        // The old regexes were unanchored, so "myindex.html" matched "index.html".
        expect(isNonContentPage("/books/published/foo/myindex.html")).toBe(
            false,
        );
    });
});

describe("PageProgressBar counts", () => {
    beforeEach(() => {
        document.body.innerHTML = progressMarkup();
        window.eBookConfig = { isLoggedIn: true };
    });

    it("counts the page as one of the activities on a freshly opened page", () => {
        // Three exercises plus the page. Opening the page attempts the page.
        new PageProgressBar({ page: 0, q1: 0, q2: 0, q3: 0 });

        expect(attempted()).toBe("1");
        expect(possible()).toBe("4");
    });

    it("counts completed activities alongside the page", () => {
        new PageProgressBar({ page: 0, q1: 1, q2: 0, q3: 2 });

        expect(attempted()).toBe("3");
        expect(possible()).toBe("4");
    });

    it("counts the page toward progress, so a page with no exercises is complete", () => {
        const bar = new PageProgressBar({});

        expect(bar.activitiesAttempted).toBe(1);
        expect(bar.activitiesPossible).toBe(1);
        expect(bar.total).toBe(1);
        expect(bar.possible).toBe(1);
    });
});
