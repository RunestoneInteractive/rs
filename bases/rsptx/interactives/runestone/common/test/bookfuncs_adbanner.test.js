/**
 * Tests for the PreTeXt donation banner: it goes above the masthead rather than
 * into the middle of the reading, appears only on the first page of a visit,
 * closing it keeps it away for 48 hours, and it rotates between three appeals,
 * one of which carries a live count of students this term.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
    placeAdBanner,
    adRecentlyDismissed,
    adVisitInProgress,
    describeStudentCount,
    fetchTermStudents,
    BANNER_COPY,
    AD_DISMISSED_KEY,
    AD_DISMISS_MS,
    AD_LAST_PAGEVIEW_KEY,
    AD_VISIT_GAP_MS,
} from "../js/bookfuncs.js";

// The appeals that need no server data, and the one that does.
const MISSION = 0;
const TERM_STUDENTS = 1;
const SHORT = 2;

function ptxPage() {
    document.body.innerHTML = `
<a class="assistive" href="#ptx-content">Skip to main content</a>
<header id="ptx-masthead" class="ptx-masthead"></header>
<nav id="ptx-navbar" class="ptx-navbar navbar"></nav>
<div class="ptx-page"><main class="ptx-main"><div id="ptx-content"></div></main></div>`;
    return document.getElementById("ptx-masthead");
}

function stubTermStudents(body, ok = true) {
    const fetchMock = vi.fn(async () => ({ ok, json: async () => body }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

beforeEach(() => {
    globalThis.eBookConfig = { new_server_prefix: "/ns" };
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("placeAdBanner", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("puts the banner above the masthead, after the skip link", async () => {
        const banner = await placeAdBanner(ptxPage(), MISSION);

        expect(banner).not.toBeNull();
        expect(banner.nextElementSibling.id).toBe("ptx-masthead");
        expect(banner.previousElementSibling.className).toBe("assistive");
    });

    it("uses the chosen appeal's copy, button and ad number", async () => {
        const banner = await placeAdBanner(ptxPage(), SHORT);

        expect(banner.querySelector("strong").textContent).toBe(
            "Free textbooks aren't free to make.",
        );
        const link = banner.querySelector("a");
        expect(link.textContent).toBe("Donate");
        expect(link.getAttribute("href")).toBe("/admin/auth/donate?ad=5");
    });

    it("gives every appeal its own ad number, clear of the legacy 1 and 2", () => {
        const ads = BANNER_COPY.map((copy) => copy.ad);
        expect(new Set(ads).size).toBe(ads.length);
        expect(ads.every((ad) => ad > 2)).toBe(true);
    });

    it("fills in the term-students count from the book server", async () => {
        const fetchMock = stubTermStudents({
            count: 48213,
            since: "2026-08-01",
        });

        const banner = await placeAdBanner(ptxPage(), TERM_STUDENTS);

        expect(fetchMock).toHaveBeenCalledWith("/ns/books/term_students");
        expect(banner.querySelector("strong").textContent).toBe(
            "More than 48,000 students have started using Runestone books since August 1.",
        );
        expect(banner.querySelector("a").getAttribute("href")).toBe(
            "/admin/auth/donate?ad=4",
        );
    });

    it("falls back to another appeal when the count is unavailable", async () => {
        stubTermStudents({}, false);

        const banner = await placeAdBanner(ptxPage(), TERM_STUDENTS);

        expect(banner.querySelector("a").getAttribute("href")).toBe(
            "/admin/auth/donate?ad=5",
        );
    });

    it("does not ask the server for a count it will not show", async () => {
        const fetchMock = stubTermStudents({
            count: 50000,
            since: "2026-08-01",
        });
        localStorage.setItem(AD_DISMISSED_KEY, String(Date.now()));

        expect(await placeAdBanner(ptxPage(), TERM_STUDENTS)).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not place a second banner", async () => {
        const top = ptxPage();
        await placeAdBanner(top, MISSION);

        expect(await placeAdBanner(top, SHORT)).toBeNull();
        expect(document.querySelectorAll(".adbanner")).toHaveLength(1);
    });

    it("closes and records the time when dismissed", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
        const banner = await placeAdBanner(ptxPage(), MISSION);

        banner.querySelector(".adbanner-close").click();

        expect(document.getElementById("rs-ad-banner")).toBeNull();
        expect(Number(localStorage.getItem(AD_DISMISSED_KEY))).toBe(Date.now());
    });

    it("stays away for 48 hours after a dismissal, then returns", async () => {
        vi.useFakeTimers();
        const dismissedAt = new Date("2026-10-08T12:00:00Z").getTime();
        localStorage.setItem(AD_DISMISSED_KEY, String(dismissedAt));

        vi.setSystemTime(dismissedAt + AD_DISMISS_MS - 60_000);
        expect(await placeAdBanner(ptxPage(), MISSION)).toBeNull();

        // Reading on past the 48 hours: still the same visit, so it waits...
        vi.setSystemTime(dismissedAt + AD_DISMISS_MS + 60_000);
        expect(await placeAdBanner(ptxPage(), MISSION)).toBeNull();

        // ...until the reader comes back for a new one.
        vi.setSystemTime(dismissedAt + AD_DISMISS_MS + AD_VISIT_GAP_MS * 2);
        expect(await placeAdBanner(ptxPage(), MISSION)).not.toBeNull();
    });

    it("shows only on the first page of a visit", async () => {
        vi.useFakeTimers();
        const start = new Date("2026-10-08T12:00:00Z").getTime();

        vi.setSystemTime(start);
        expect(await placeAdBanner(ptxPage(), MISSION)).not.toBeNull();

        // Page after page, each under 30 minutes apart, for well over an hour.
        for (let minutes = 20; minutes <= 100; minutes += 20) {
            vi.setSystemTime(start + minutes * 60_000);
            expect(await placeAdBanner(ptxPage(), MISSION)).toBeNull();
        }

        // Back after a break: a new visit.
        vi.setSystemTime(start + 100 * 60_000 + AD_VISIT_GAP_MS);
        expect(await placeAdBanner(ptxPage(), MISSION)).not.toBeNull();
    });
});

describe("describeStudentCount", () => {
    it("rounds down to two significant figures and says so", () => {
        expect(describeStudentCount(48213)).toBe("More than 48,000");
        expect(describeStudentCount(312450)).toBe("More than 310,000");
        expect(describeStudentCount(1234)).toBe("More than 1,200");
    });

    it("does not claim 'more than' for a round number", () => {
        expect(describeStudentCount(48000)).toBe("48,000");
    });
});

describe("fetchTermStudents", () => {
    it("formats the term start in UTC, whatever the reader's zone", async () => {
        stubTermStudents({ count: 5000, since: "2026-01-01" });

        expect(await fetchTermStudents()).toEqual({
            count: 5000,
            since: "January 1",
        });
    });

    it("declines a count too small to impress", async () => {
        stubTermStudents({ count: 12, since: "2026-08-01" });

        expect(await fetchTermStudents()).toBeNull();
    });

    it("survives a network failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new TypeError("Failed to fetch");
            }),
        );

        expect(await fetchTermStudents()).toBeNull();
    });
});

describe("adVisitInProgress", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("treats the first page view ever as a new visit", () => {
        expect(adVisitInProgress(1_000_000)).toBe(false);
        expect(Number(localStorage.getItem(AD_LAST_PAGEVIEW_KEY))).toBe(
            1_000_000,
        );
    });

    it("ends a visit after 30 minutes without a page view", () => {
        const now = 10 * AD_VISIT_GAP_MS;
        localStorage.setItem(AD_LAST_PAGEVIEW_KEY, String(now - 60_000));
        expect(adVisitInProgress(now)).toBe(true);

        localStorage.setItem(
            AD_LAST_PAGEVIEW_KEY,
            String(now - AD_VISIT_GAP_MS),
        );
        expect(adVisitInProgress(now)).toBe(false);
    });

    it("ignores a page view time in the future", () => {
        const now = 10 * AD_VISIT_GAP_MS;
        localStorage.setItem(AD_LAST_PAGEVIEW_KEY, String(now + 60_000));

        expect(adVisitInProgress(now)).toBe(false);
    });
});

describe("adRecentlyDismissed", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("is false when nothing has been dismissed", () => {
        expect(adRecentlyDismissed()).toBe(false);
    });

    it("ignores a dismissal time in the future", () => {
        const now = Date.now();
        localStorage.setItem(
            AD_DISMISSED_KEY,
            String(now + AD_DISMISS_MS * 10),
        );

        expect(adRecentlyDismissed(now)).toBe(false);
    });

    it("ignores junk in storage", () => {
        localStorage.setItem(AD_DISMISSED_KEY, "not a number");

        expect(adRecentlyDismissed()).toBe(false);
    });
});
