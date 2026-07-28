/**
 * Detecting when an instructor is authoring deadlines from a different
 * timezone than the course runs in.
 *
 * The date picker works in the browser's timezone, so an instructor in Chicago
 * setting "11:59 PM" for a Los Angeles course is really setting 9:59 PM for
 * their students. That is easy to do by accident and hard to notice, so the
 * builder warns when the two zones disagree.
 */

export interface CourseTimezoneMismatch {
  courseTimezone: string;
  browserTimezone: string;
  /** Offset difference in hours at the given instant, browser minus course. */
  hoursAhead: number;
}

export const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
};

/** Offset of a timezone from UTC, in minutes, at a given instant. */
const offsetMinutes = (timeZone: string, at: Date): number | null => {
  try {
    // Formatting the same instant as if it were UTC gives back the wall clock
    // in that zone; the difference from the real instant is the offset.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).formatToParts(at);

    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUTC = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second")
    );

    return Math.round((asUTC - at.getTime()) / 60000);
  } catch {
    return null;
  }
};

/**
 * Compare the course timezone against the browser's.
 *
 * Returns null when they agree, when either is unknown, or when they differ in
 * name but not in actual offset at `at` -- "America/Chicago" and
 * "America/Mexico_City" may be the same clock, and warning about that would be
 * noise. A course with no timezone set is treated as UTC, matching the
 * backend.
 */
export const getCourseTimezoneMismatch = (
  courseTimezone: string | undefined | null,
  at: Date = new Date(),
  browserTimezone: string = getBrowserTimezone()
): CourseTimezoneMismatch | null => {
  const course = courseTimezone || "UTC";
  if (!browserTimezone || browserTimezone === course) {
    return null;
  }

  const courseOffset = offsetMinutes(course, at);
  const browserOffset = offsetMinutes(browserTimezone, at);
  if (courseOffset === null || browserOffset === null) {
    return null;
  }

  const diff = browserOffset - courseOffset;
  if (diff === 0) {
    return null;
  }

  return {
    courseTimezone: course,
    browserTimezone,
    hoursAhead: diff / 60
  };
};

/** Render an instant as wall clock time in a specific timezone. */
export const formatInTimezone = (date: Date, timeZone: string): string => {
  try {
    return date.toLocaleString(undefined, {
      timeZone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    });
  } catch {
    return date.toLocaleString();
  }
};
