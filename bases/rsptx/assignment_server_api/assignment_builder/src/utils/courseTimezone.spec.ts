import { describe, expect, it } from "vitest";

import { formatInTimezone, getCourseTimezoneMismatch } from "./courseTimezone";

// A summer instant, so US zones are on daylight time.
const SUMMER = new Date("2026-07-15T12:00:00Z");
// A winter instant, so they are not.
const WINTER = new Date("2026-01-15T12:00:00Z");

describe("getCourseTimezoneMismatch", () => {
  it("returns null when the browser matches the course", () => {
    expect(getCourseTimezoneMismatch("America/Chicago", SUMMER, "America/Chicago")).toBeNull();
  });

  it("reports how far ahead the browser is", () => {
    // Chicago (CDT, -5) is 2 hours ahead of Los Angeles (PDT, -7).
    const result = getCourseTimezoneMismatch("America/Los_Angeles", SUMMER, "America/Chicago");

    expect(result).toEqual({
      courseTimezone: "America/Los_Angeles",
      browserTimezone: "America/Chicago",
      hoursAhead: 2
    });
  });

  it("reports a negative offset when the browser is behind", () => {
    const result = getCourseTimezoneMismatch("America/Chicago", SUMMER, "America/Los_Angeles");

    expect(result?.hoursAhead).toBe(-2);
  });

  it("handles zones on the other side of the world", () => {
    // Tokyo (+9) vs Chicago (CDT, -5) is 14 hours.
    const result = getCourseTimezoneMismatch("America/Chicago", SUMMER, "Asia/Tokyo");

    expect(result?.hoursAhead).toBe(14);
  });

  it("handles half hour offsets", () => {
    const result = getCourseTimezoneMismatch("UTC", SUMMER, "Asia/Kolkata");

    expect(result?.hoursAhead).toBe(5.5);
  });

  it("treats a course with no timezone as UTC", () => {
    expect(getCourseTimezoneMismatch(null, SUMMER, "UTC")).toBeNull();
    expect(getCourseTimezoneMismatch("", SUMMER, "UTC")).toBeNull();
    expect(getCourseTimezoneMismatch(undefined, SUMMER, "Asia/Tokyo")?.hoursAhead).toBe(9);
  });

  it("does not warn when two differently named zones share an offset", () => {
    // Same clock, different name -- warning about this would be noise.
    expect(getCourseTimezoneMismatch("America/Chicago", WINTER, "America/Mexico_City")).toBeNull();
  });

  it("uses the offset in effect at the given instant, not today's", () => {
    // Phoenix does not observe DST, so its gap with Chicago changes by season.
    const summer = getCourseTimezoneMismatch("America/Phoenix", SUMMER, "America/Chicago");
    const winter = getCourseTimezoneMismatch("America/Phoenix", WINTER, "America/Chicago");

    expect(summer?.hoursAhead).toBe(2);
    expect(winter?.hoursAhead).toBe(1);
  });

  it("returns null when the browser timezone is unknown", () => {
    expect(getCourseTimezoneMismatch("America/Chicago", SUMMER, "")).toBeNull();
  });

  it("returns null rather than throwing on an unrecognized zone", () => {
    expect(getCourseTimezoneMismatch("Mars/Olympus", SUMMER, "America/Chicago")).toBeNull();
  });
});

describe("formatInTimezone", () => {
  it("renders the instant as wall clock time in the requested zone", () => {
    // 2026-09-02 04:59 UTC is 2026-09-01 21:59 in Los Angeles.
    const result = formatInTimezone(new Date("2026-09-02T04:59:00Z"), "America/Los_Angeles");

    expect(result).toContain("Sep");
    expect(result).toContain("01");
    expect(result).toContain("09:59");
    expect(result).toMatch(/PDT|GMT-7/);
  });

  it("falls back to a plain locale string on a bad zone", () => {
    const date = new Date("2026-09-02T04:59:00Z");

    expect(formatInTimezone(date, "Mars/Olympus")).toBe(date.toLocaleString());
  });
});
