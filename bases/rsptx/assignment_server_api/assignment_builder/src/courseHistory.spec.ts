import {
  getRestoredCourseDestination,
  markCourseSwitch,
  reconcileServerCourse,
  syncCourseHistoryEntry
} from "./courseHistory";

const HISTORY_COURSE_KEY = "__runestoneCourse";

describe("course-aware browser history", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({ key: "router-key", idx: 2 }, "", "/grader/22");
  });

  it("stamps a history entry while preserving router state", () => {
    expect(syncCourseHistoryEntry("course-1", "/grader/22")).toBeNull();
    expect(window.history.state).toEqual({
      key: "router-key",
      idx: 2,
      __runestoneCourse: "course-1"
    });
    expect(sessionStorage.getItem("assignment-builder.active-course")).toBe("course-1");
  });

  it("marks the target course before reloading after a switch", () => {
    markCourseSwitch("course-2");

    expect(Object.entries(window.history.state)).toContainEqual(["__runestoneCourse", "course-2"]);
    expect(sessionStorage.getItem("assignment-builder.active-course")).toBe("course-2");
  });

  it.each([
    [
      "/grader/22/questions/24/students/filter_full_credit_student",
      "/assignment/instructor/grader"
    ],
    ["/gradebook", "/assignment/instructor/grader"],
    ["/builder/22", "/assignment/instructor/builder"]
  ])("reconciles a restored %s page with the server course", (pathname, destination) => {
    expect(reconcileServerCourse("course-1", "course-2", pathname)).toBe(destination);
    expect(sessionStorage.getItem("assignment-builder.active-course")).toBe("course-2");
    expect(window.history.state[HISTORY_COURSE_KEY]).toBe("course-2");
  });

  it.each([undefined, "course-1"])(
    "does not redirect when the server course is %s",
    (serverCourse) => {
      expect(reconcileServerCourse("course-1", serverCourse, "/grader/22")).toBeNull();
    }
  );

  it("redirects a stale grader entry to the grader assignment list", () => {
    syncCourseHistoryEntry("course-1", "/grader/22");

    expect(syncCourseHistoryEntry("course-2", "/grader/22")).toBe("/assignment/instructor/grader");
  });

  it("redirects a stale builder entry to the builder assignment list", () => {
    syncCourseHistoryEntry("course-1", "/builder/22");

    expect(syncCourseHistoryEntry("course-2", "/builder/22")).toBe(
      "/assignment/instructor/builder"
    );
  });

  it("redirects an old course page restored from the back-forward cache", () => {
    markCourseSwitch("course-2");

    expect(getRestoredCourseDestination(true, "course-1", "/grader/22")).toBe(
      "/assignment/instructor/grader"
    );
    expect(getRestoredCourseDestination(false, "course-1", "/grader/22")).toBeNull();
    expect(getRestoredCourseDestination(true, "course-2", "/grader/22")).toBeNull();
  });

  it("redirects before a restored React effect can overwrite the active course", () => {
    syncCourseHistoryEntry("course-1", "/grader/22");
    window.history.pushState({ key: "question-key", idx: 3 }, "", "/grader/22/questions/24");
    markCourseSwitch("course-2");
    window.history.replaceState(
      { key: "router-key", idx: 2, __runestoneCourse: "course-1" },
      "",
      "/grader/22"
    );

    expect(syncCourseHistoryEntry("course-1", "/grader/22")).toBe("/assignment/instructor/grader");
    expect(sessionStorage.getItem("assignment-builder.active-course")).toBe("course-2");
    expect(window.history.state[HISTORY_COURSE_KEY]).toBe("course-2");
  });

  it("accepts a course changed outside this dropdown without redirecting forever", () => {
    window.history.replaceState({ key: "fresh-entry", idx: 2 }, "", "/grader");
    sessionStorage.setItem("assignment-builder.active-course", "course-2");
    sessionStorage.removeItem("assignment-builder.course-switch-history-index");

    expect(syncCourseHistoryEntry("course-1", "/grader")).toBeNull();
    expect(sessionStorage.getItem("assignment-builder.active-course")).toBe("course-1");
  });

  it("keeps Back out of assignment-specific grader pages after switching courses", () => {
    syncCourseHistoryEntry("course-1", "/grader/22");
    const assignmentEntry = window.history.state;

    window.history.pushState(
      { key: "question-key", idx: 3 },
      "",
      "/grader/22/questions/24/students/filter_full_credit_student"
    );
    syncCourseHistoryEntry(
      "course-1",
      "/grader/22/questions/24/students/filter_full_credit_student"
    );
    markCourseSwitch("course-2");

    window.history.replaceState(
      { key: assignmentEntry.key, idx: assignmentEntry.idx },
      "",
      "/grader/22"
    );

    expect(syncCourseHistoryEntry("course-2", "/grader/22")).toBe("/assignment/instructor/grader");
  });
});
