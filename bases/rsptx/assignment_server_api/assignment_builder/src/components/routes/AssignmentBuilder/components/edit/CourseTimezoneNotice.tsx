import { Icon } from "@components/ui/Icon";
import { Alert } from "@mantine/core";

import { formatInTimezone, getCourseTimezoneMismatch } from "@/utils/courseTimezone";
import { parseUTCDate } from "@/utils/date";

interface CourseTimezoneNoticeProps {
  /** The due date currently in the form, as a naive UTC string. */
  value?: string | null;
}

/**
 * Warn an instructor who is setting deadlines from a different timezone than
 * the course runs in.
 *
 * The picker edits in the browser's timezone, so "11:59 PM" typed in Chicago
 * for a Los Angeles course is 9:59 PM for the students. Showing what the
 * chosen instant actually is in course time makes that visible at the moment
 * the deadline is set, rather than after someone misses it.
 */
export const CourseTimezoneNotice = ({ value }: CourseTimezoneNoticeProps) => {
  const courseTimezone = window.eBookConfig?.courseTimezone;
  const chosen = value ? parseUTCDate(value) : null;
  const at = chosen && !isNaN(chosen.getTime()) ? chosen : new Date();
  const mismatch = getCourseTimezoneMismatch(courseTimezone, at);

  if (!mismatch) {
    return null;
  }

  const direction = mismatch.hoursAhead > 0 ? "ahead of" : "behind";
  const hours = Math.abs(mismatch.hoursAhead);
  const hourLabel = hours === 1 ? "hour" : "hours";

  return (
    <Alert
      variant="light"
      color="yellow"
      icon={<Icon name="exclamation-triangle" size={16} />}
      title="Your timezone differs from the course timezone"
      data-testid="course-timezone-notice"
    >
      You are in {mismatch.browserTimezone}, {hours} {hourLabel} {direction} the course timezone (
      {mismatch.courseTimezone}). Dates here are shown on your clock.
      {chosen && !isNaN(chosen.getTime()) && (
        <>
          {" "}
          This deadline is <strong>{formatInTimezone(chosen, mismatch.courseTimezone)}</strong> in
          course time.
        </>
      )}
    </Alert>
  );
};
