/**
 * Tests for the page progress bar: which pages get one, and what the counts
 * beside it report.
 *
 * See issue #613: the Book Index page (genindex.html) still showed a progress
 * bar, because the list of navigation pages here had drifted apart from the
 * copies in user-highlights.js and the sphinx progress template.
 *
 * See issue #614: opening a page read "1 of 4" when only three activities were
 * visible. The page itself counts as one item internally -- that is what lets a
 * page with no activities be completed -- but it is not one of the "activities
 * on this page" the reader can see, so it is kept out of the displayed counts.
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
        // Two of three done against a requirement of three. The page entry used
        // to be counted here, which sent the score one activity early.
        const { sent } = barWithSpy(
            { q1: 1, q2: 1, q3: 0 },
            { activities_required: 3 },
        );

        expect(sent).not.toHaveBeenCalled();
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

        // updateProgress() compares against this later, so it has to describe
        // real activities rather than including the page.
        expect(bar.assignment_spec.activities_required).toBe(3);
    });

    it("sends the score from updateProgress on the last required activity", () => {
        const { bar, sent } = barWithSpy(
            { q1: 0, q2: 0 },
            { activities_required: 2 },
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

describe("PageProgressBar counts (#614)", () => {
    beforeEach(() => {
        document.body.innerHTML = progressMarkup();
        window.eBookConfig = { isLoggedIn: true };
    });

    it("reports zero attempted on a freshly opened page", () => {
        // Three activities, none touched, as the server would report them.
        new PageProgressBar({ q1: 0, q2: 0, q3: 0 });

        expect(attempted()).toBe("0");
        expect(possible()).toBe("3");
    });

    it("does not count the page toward the visible activity total", () => {
        // countActivitiesInPage() supplies a page entry; it must not show up.
        new PageProgressBar({ page: 0, q1: 0, q2: 0, q3: 0 });

        expect(attempted()).toBe("0");
        expect(possible()).toBe("3");
    });

    it("gives logged in and logged out readers the same counts", () => {
        const withoutPage = new PageProgressBar({ q1: 0, q2: 0, q3: 0 });
        const withPage = new PageProgressBar({ page: 0, q1: 0, q2: 0, q3: 0 });

        expect(withoutPage.activitiesPossible).toBe(
            withPage.activitiesPossible,
        );
        expect(withoutPage.activitiesAttempted).toBe(
            withPage.activitiesAttempted,
        );
    });

    it("counts completed activities", () => {
        new PageProgressBar({ q1: 1, q2: 0, q3: 2 });

        expect(attempted()).toBe("2");
        expect(possible()).toBe("3");
    });

    it("still counts the page toward progress, so a page with no activities is complete", () => {
        const bar = new PageProgressBar({});

        // Nothing for the reader to do, so nothing to report...
        expect(bar.activitiesPossible).toBe(0);
        expect(bar.activitiesAttempted).toBe(0);
        // ...but opening the page is itself the whole of the progress.
        expect(bar.total).toBe(1);
        expect(bar.possible).toBe(1);
    });
});
