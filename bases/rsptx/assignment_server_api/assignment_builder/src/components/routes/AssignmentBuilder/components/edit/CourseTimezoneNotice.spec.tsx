import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { CourseTimezoneNotice } from "./CourseTimezoneNotice";

const setCourseTimezone = (timezone: string | undefined) => {
  window.eBookConfig = { ...(window.eBookConfig || {}), courseTimezone: timezone };
};

/** Pin the browser timezone Intl reports, since the test host varies. */
const setBrowserTimezone = (timeZone: string) => {
  const original = Intl.DateTimeFormat;

  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(((
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions
  ) => {
    const formatter = new original(locales, { timeZone, ...options });
    const resolved = formatter.resolvedOptions.bind(formatter);

    formatter.resolvedOptions = () => ({ ...resolved(), timeZone });
    return formatter;
  }) as unknown as typeof Intl.DateTimeFormat);
};

afterEach(() => {
  vi.restoreAllMocks();
  setCourseTimezone(undefined);
});

describe("CourseTimezoneNotice", () => {
  it("renders nothing when the browser matches the course", () => {
    setCourseTimezone("America/Chicago");
    setBrowserTimezone("America/Chicago");

    renderWithMantine(<CourseTimezoneNotice value="2026-09-02T04:59:00" />);

    expect(screen.queryByTestId("course-timezone-notice")).not.toBeInTheDocument();
  });

  it("renders nothing when the course has no timezone and the browser is UTC", () => {
    setCourseTimezone(undefined);
    setBrowserTimezone("UTC");

    renderWithMantine(<CourseTimezoneNotice value="2026-09-02T04:59:00" />);

    expect(screen.queryByTestId("course-timezone-notice")).not.toBeInTheDocument();
  });

  it("warns when the instructor is east of the course", () => {
    setCourseTimezone("America/Los_Angeles");
    setBrowserTimezone("America/Chicago");

    renderWithMantine(<CourseTimezoneNotice value="2026-09-02T04:59:00" />);

    const notice = screen.getByTestId("course-timezone-notice");

    expect(notice).toHaveTextContent("America/Chicago");
    expect(notice).toHaveTextContent("2 hours ahead of");
    expect(notice).toHaveTextContent("America/Los_Angeles");
  });

  it("warns when the instructor is west of the course", () => {
    setCourseTimezone("America/Chicago");
    setBrowserTimezone("America/Los_Angeles");

    renderWithMantine(<CourseTimezoneNotice value="2026-09-02T04:59:00" />);

    expect(screen.getByTestId("course-timezone-notice")).toHaveTextContent("2 hours behind");
  });

  it("uses a singular hour label for a one hour gap", () => {
    setCourseTimezone("America/Chicago");
    setBrowserTimezone("America/New_York");

    renderWithMantine(<CourseTimezoneNotice value="2026-09-02T04:59:00" />);

    expect(screen.getByTestId("course-timezone-notice")).toHaveTextContent("1 hour ahead");
  });

  it("shows the chosen deadline in course time", () => {
    setCourseTimezone("America/Los_Angeles");
    setBrowserTimezone("America/Chicago");

    // 2026-09-02 04:59 UTC is 09:59 PM on Sep 1 in Los Angeles.
    renderWithMantine(<CourseTimezoneNotice value="2026-09-02T04:59:00" />);

    const notice = screen.getByTestId("course-timezone-notice");

    expect(notice).toHaveTextContent("in course time");
    expect(notice).toHaveTextContent("09:59");
  });

  it("still warns with no due date chosen yet, omitting the course time line", () => {
    setCourseTimezone("America/Los_Angeles");
    setBrowserTimezone("America/Chicago");

    renderWithMantine(<CourseTimezoneNotice />);

    const notice = screen.getByTestId("course-timezone-notice");

    expect(notice).toHaveTextContent("America/Los_Angeles");
    expect(notice).not.toHaveTextContent("in course time");
  });
});
