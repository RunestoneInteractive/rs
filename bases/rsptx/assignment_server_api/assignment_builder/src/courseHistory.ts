import { getCourseSwitchDestination } from "./navUtils.js";

const ACTIVE_COURSE_KEY = "assignment-builder.active-course";
const SWITCH_HISTORY_INDEX_KEY = "assignment-builder.course-switch-history-index";
const HISTORY_COURSE_KEY = "__runestoneCourse";

const getHistoryState = (): Record<string, unknown> => {
  const state = window.history.state;

  return typeof state === "object" && state !== null ? state : {};
};

const getStoredCourse = (): string | null => {
  try {
    return window.sessionStorage.getItem(ACTIVE_COURSE_KEY);
  } catch {
    return null;
  }
};

const storeCourse = (courseName: string): void => {
  try {
    window.sessionStorage.setItem(ACTIVE_COURSE_KEY, courseName);
  } catch {
    // Course switching must still work when session storage is unavailable.
  }
};

const getHistoryIndex = (): number | null => {
  const index = getHistoryState().idx;

  return typeof index === "number" ? index : null;
};

const getSwitchHistoryIndex = (): number | null => {
  try {
    const value = window.sessionStorage.getItem(SWITCH_HISTORY_INDEX_KEY);

    return value === null ? null : Number(value);
  } catch {
    return null;
  }
};

const storeSwitchHistoryIndex = (index: number): void => {
  try {
    window.sessionStorage.setItem(SWITCH_HISTORY_INDEX_KEY, String(index));
  } catch {
    // History stamping remains the fallback when session storage is unavailable.
  }
};

const isSectionLanding = (pathname: string): boolean =>
  pathname === "/" || pathname === "/builder" || pathname === "/grader";

const isBeforeCourseSwitch = (): boolean => {
  const currentIndex = getHistoryIndex();
  const switchIndex = getSwitchHistoryIndex();

  return currentIndex !== null && switchIndex !== null && currentIndex < switchIndex;
};

const stampHistoryEntry = (courseName: string): void => {
  window.history.replaceState(
    { ...getHistoryState(), [HISTORY_COURSE_KEY]: courseName },
    document.title
  );
};

/** Record the target course before the full-page navigation completes. */
export const markCourseSwitch = (courseName: string): void => {
  storeCourse(courseName);
  stampHistoryEntry(courseName);
  const historyIndex = getHistoryIndex();

  if (historyIndex !== null) storeSwitchHistoryIndex(historyIndex);
};

/** Reconcile a BFCache-restored page with the course currently stored by the server. */
export const reconcileServerCourse = (
  pageCourse: string,
  serverCourse: string | undefined,
  pathname: string
): string | null => {
  if (!serverCourse || serverCourse === pageCourse) return null;

  markCourseSwitch(serverCourse);
  return getCourseSwitchDestination(pathname);
};

/**
 * Associate the current browser-history entry with its course. A stamped entry
 * from another course is stale and must not restore an assignment-specific URL.
 */
export const syncCourseHistoryEntry = (currentCourse: string, pathname: string): string | null => {
  const entryCourse = getHistoryState()[HISTORY_COURSE_KEY];
  const activeCourse = getStoredCourse();

  // A page restored from the back-forward cache can run this effect before its
  // pageshow handler. Compare the restored entry with the tab's active course
  // before the old React tree can overwrite session storage.
  if (activeCourse && typeof entryCourse === "string" && entryCourse !== activeCourse) {
    // location.replace preserves the current entry's history state. Stamp the
    // target first so the landing page does not inherit stale state and loop.
    stampHistoryEntry(activeCourse);
    return getCourseSwitchDestination(pathname);
  }

  if (typeof entryCourse === "string" && entryCourse !== currentCourse) {
    const courseAfterSwitch = getSwitchHistoryIndex() !== null ? activeCourse : null;

    storeCourse(courseAfterSwitch ?? currentCourse);
    stampHistoryEntry(courseAfterSwitch ?? currentCourse);
    return getCourseSwitchDestination(pathname);
  }

  if (isBeforeCourseSwitch()) {
    if (!isSectionLanding(pathname)) {
      stampHistoryEntry(currentCourse);
      return getCourseSwitchDestination(pathname);
    }

    const historyIndex = getHistoryIndex();

    if (historyIndex !== null) storeSwitchHistoryIndex(historyIndex);
  }

  storeCourse(currentCourse);
  stampHistoryEntry(currentCourse);

  return null;
};

/** Detect a page from the old course restored by the browser's back-forward cache. */
export const getRestoredCourseDestination = (
  persisted: boolean,
  pageCourse: string,
  pathname: string
): string | null => {
  if (!persisted) return null;

  const activeCourse = getStoredCourse();
  const activeCourseMismatch = Boolean(activeCourse && activeCourse !== pageCourse);
  const staleNestedEntry = isBeforeCourseSwitch() && !isSectionLanding(pathname);

  if (!activeCourseMismatch && !staleNestedEntry) return null;

  stampHistoryEntry(activeCourseMismatch ? activeCourse! : pageCourse);
  return getCourseSwitchDestination(pathname);
};
