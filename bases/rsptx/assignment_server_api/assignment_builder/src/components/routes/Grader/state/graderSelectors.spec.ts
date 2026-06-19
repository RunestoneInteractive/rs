import type { GraderStudentAnswer } from "@store/grader/grader.logic.api";
import {
  isAutogradeable,
  getStudentStatus,
  getQuestionProgress,
  findNextUngradedSid,
  findFirstUngradedSid,
  statusLabel,
  statusIcon,
  statusColor,
  effectiveViewMode
} from "./graderSelectors";

const makeAnswer = (overrides: Partial<GraderStudentAnswer> = {}): GraderStudentAnswer => ({
  sid: "student1",
  answer: "",
  attempts: 1,
  score: null,
  comment: null,
  max_points: 10,
  ...overrides
});

describe("isAutogradeable", () => {
  it("returns false when autograde is undefined", () => {
    expect(isAutogradeable({})).toBe(false);
  });

  it("returns false when autograde is 'manual'", () => {
    expect(isAutogradeable({ autograde: "manual" })).toBe(false);
  });

  it("returns true when autograde is 'pct_correct'", () => {
    expect(isAutogradeable({ autograde: "pct_correct" })).toBe(true);
  });

  it("returns true when autograde is 'all_or_nothing'", () => {
    expect(isAutogradeable({ autograde: "all_or_nothing" })).toBe(true);
  });

  it("returns true for any non-manual, non-empty autograde value", () => {
    expect(isAutogradeable({ autograde: "some_custom" })).toBe(true);
  });
});

describe("getStudentStatus", () => {
  describe("in_progress — dirty sid takes priority", () => {
    it("returns 'in_progress' when sid is in dirtySids regardless of other fields", () => {
      const s = makeAnswer({ sid: "s1", score: 5 });
      expect(getStudentStatus(s, undefined, { dirtySids: new Set(["s1"]) })).toBe("in_progress");
    });

    it("returns normal status when sid is NOT in dirtySids", () => {
      const s = makeAnswer({ sid: "s2", attempts: 0, score: null });
      expect(getStudentStatus(s, undefined, { dirtySids: new Set(["s1"]) })).toBe("no_submission");
    });
  });

  describe("no_submission", () => {
    it("returns 'no_submission' when attempts is 0 and score is null", () => {
      const s = makeAnswer({ attempts: 0, score: null });
      expect(getStudentStatus(s)).toBe("no_submission");
    });

    it("does NOT return 'no_submission' when attempts is 0 but score is set", () => {
      const s = makeAnswer({ attempts: 0, score: 0 });
      expect(getStudentStatus(s)).not.toBe("no_submission");
    });

    it("does NOT return 'no_submission' when attempts > 0", () => {
      const s = makeAnswer({ attempts: 1, score: null });
      expect(getStudentStatus(s)).not.toBe("no_submission");
    });
  });

  describe("manual grading path (no autograde or autograde='manual')", () => {
    it("returns 'graded' when score is not null", () => {
      const s = makeAnswer({ attempts: 1, score: 8 });
      expect(getStudentStatus(s, { autograde: "manual" })).toBe("graded");
    });

    it("returns 'graded' when score is 0", () => {
      const s = makeAnswer({ attempts: 1, score: 0 });
      expect(getStudentStatus(s)).toBe("graded");
    });

    it("returns 'graded' when comment is non-empty and score is null", () => {
      const s = makeAnswer({ attempts: 1, score: null, comment: "good job" });
      expect(getStudentStatus(s)).toBe("graded");
    });

    it("returns 'pending' when score is null and comment is empty string", () => {
      const s = makeAnswer({ attempts: 1, score: null, comment: "" });
      expect(getStudentStatus(s)).toBe("pending");
    });

    it("returns 'pending' when score is null and comment is null", () => {
      const s = makeAnswer({ attempts: 1, score: null, comment: null });
      expect(getStudentStatus(s)).toBe("pending");
    });

    it("returns 'pending' when q is undefined and no score or comment", () => {
      const s = makeAnswer({ attempts: 1, score: null });
      expect(getStudentStatus(s, undefined)).toBe("pending");
    });
  });

  describe("auto-grading path", () => {
    const autoQ = { autograde: "pct_correct" };

    it("returns 'autograded' when score is set and no comment", () => {
      const s = makeAnswer({ attempts: 1, score: 7 });
      expect(getStudentStatus(s, autoQ)).toBe("autograded");
    });

    it("returns 'graded' when score is set and comment is non-empty", () => {
      const s = makeAnswer({ attempts: 1, score: 7, comment: "nice" });
      expect(getStudentStatus(s, autoQ)).toBe("graded");
    });

    it("returns 'pending' when score is null", () => {
      const s = makeAnswer({ attempts: 1, score: null });
      expect(getStudentStatus(s, autoQ)).toBe("pending");
    });

    it("returns 'autograded' when score is 0 and no comment", () => {
      const s = makeAnswer({ attempts: 1, score: 0 });
      expect(getStudentStatus(s, autoQ)).toBe("autograded");
    });
  });
});

describe("getQuestionProgress", () => {
  it("returns all-zero progress for empty answers array", () => {
    const result = getQuestionProgress([]);
    expect(result).toEqual({
      total: 0,
      graded: 0,
      autograded: 0,
      pending: 0,
      noSubmission: 0,
      inProgress: 0,
      donePct: 0
    });
  });

  it("calculates correct counts for mixed statuses", () => {
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: 5, comment: "ok" }),
      makeAnswer({ sid: "s2", attempts: 1, score: null }),
      makeAnswer({ sid: "s3", attempts: 0, score: null }),
      makeAnswer({ sid: "s4", attempts: 1, score: null })
    ];
    const result = getQuestionProgress(answers, { autograde: "manual" });
    expect(result.total).toBe(4);
    expect(result.graded).toBe(1);
    expect(result.pending).toBe(2);
    expect(result.noSubmission).toBe(1);
    expect(result.autograded).toBe(0);
    expect(result.inProgress).toBe(0);
  });

  it("counts autograded answers under auto-grading question", () => {
    const autoQ = { autograde: "pct_correct" };
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: 8 }),
      makeAnswer({ sid: "s2", attempts: 1, score: 6, comment: "nice" }),
      makeAnswer({ sid: "s3", attempts: 1, score: null })
    ];
    const result = getQuestionProgress(answers, autoQ);
    expect(result.autograded).toBe(1);
    expect(result.graded).toBe(1);
    expect(result.pending).toBe(1);
  });

  it("counts in_progress answers from dirtySids", () => {
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: null }),
      makeAnswer({ sid: "s2", attempts: 1, score: null })
    ];
    const result = getQuestionProgress(answers, undefined, { dirtySids: new Set(["s1"]) });
    expect(result.inProgress).toBe(1);
    expect(result.pending).toBe(1);
  });

  it("calculates donePct correctly", () => {
    const autoQ = { autograde: "pct_correct" };
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: 8 }),
      makeAnswer({ sid: "s2", attempts: 1, score: 7, comment: "good" }),
      makeAnswer({ sid: "s3", attempts: 1, score: null }),
      makeAnswer({ sid: "s4", attempts: 1, score: null })
    ];
    const result = getQuestionProgress(answers, autoQ);
    expect(result.donePct).toBe(50);
  });

  it("donePct is 0 when total is 0", () => {
    const result = getQuestionProgress([]);
    expect(result.donePct).toBe(0);
  });

  it("donePct is 100 when all are graded", () => {
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: 8, comment: "ok" }),
      makeAnswer({ sid: "s2", attempts: 1, score: 6, comment: "ok" })
    ];
    const result = getQuestionProgress(answers, { autograde: "manual" });
    expect(result.donePct).toBe(100);
  });
});

describe("findNextUngradedSid", () => {
  it("returns null for empty answers array", () => {
    expect(findNextUngradedSid([], 0)).toBeNull();
  });

  it("returns null when all answers after fromIndex are graded", () => {
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: null }),
      makeAnswer({ sid: "s2", attempts: 1, score: 5 }),
      makeAnswer({ sid: "s3", attempts: 1, score: 7 })
    ];
    expect(findNextUngradedSid(answers, 0, { autograde: "manual" })).toBeNull();
  });

  it("returns the sid of the next pending answer after fromIndex", () => {
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: 5 }),
      makeAnswer({ sid: "s2", attempts: 1, score: null }),
      makeAnswer({ sid: "s3", attempts: 1, score: null })
    ];
    expect(findNextUngradedSid(answers, 0, { autograde: "manual" })).toBe("s2");
  });

  it("skips graded answers between current and next ungraded", () => {
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: 5 }),
      makeAnswer({ sid: "s2", attempts: 1, score: 7 }),
      makeAnswer({ sid: "s3", attempts: 1, score: null })
    ];
    expect(findNextUngradedSid(answers, 0, { autograde: "manual" })).toBe("s3");
  });

  it("returns in_progress sid as a candidate", () => {
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: 5 }),
      makeAnswer({ sid: "s2", attempts: 1, score: 7 }),
      makeAnswer({ sid: "s3", attempts: 1, score: null })
    ];
    const dirtySids = new Set(["s3"]);
    expect(findNextUngradedSid(answers, 0, { autograde: "manual" }, { dirtySids })).toBe("s3");
  });

  it("returns null when fromIndex is the last element", () => {
    const answers: GraderStudentAnswer[] = [makeAnswer({ sid: "s1", attempts: 1, score: null })];
    expect(findNextUngradedSid(answers, 0)).toBeNull();
  });
});

describe("findFirstUngradedSid", () => {
  it("returns null when all students are graded", () => {
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: 5 }),
      makeAnswer({ sid: "s2", attempts: 1, score: 7 })
    ];
    expect(findFirstUngradedSid(answers, { autograde: "manual" })).toBeNull();
  });

  it("returns the sid of the first pending answer", () => {
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: 5 }),
      makeAnswer({ sid: "s2", attempts: 1, score: null }),
      makeAnswer({ sid: "s3", attempts: 1, score: null })
    ];
    expect(findFirstUngradedSid(answers, { autograde: "manual" })).toBe("s2");
  });

  it("returns the first element sid if it is ungraded", () => {
    const answers: GraderStudentAnswer[] = [
      makeAnswer({ sid: "s1", attempts: 1, score: null }),
      makeAnswer({ sid: "s2", attempts: 1, score: 5 })
    ];
    expect(findFirstUngradedSid(answers, { autograde: "manual" })).toBe("s1");
  });

  it("returns null for empty array", () => {
    expect(findFirstUngradedSid([])).toBeNull();
  });
});

describe("statusLabel", () => {
  it("has a label for every StudentGradingStatus value", () => {
    expect(statusLabel.graded).toBe("Graded");
    expect(statusLabel.autograded).toBe("Auto-graded");
    expect(statusLabel.in_progress).toBe("In progress");
    expect(statusLabel.pending).toBe("Pending");
    expect(statusLabel.no_submission).toBe("No submission");
  });
});

describe("statusIcon glyph mapping", () => {
  it("pairs every StudentGradingStatus with its glyph: check=graded, bolt=autograded, half=in progress, circle=pending, dash=no submission", () => {
    expect(statusIcon.graded).toBe("check-circle");
    expect(statusIcon.autograded).toBe("bolt");
    expect(statusIcon.in_progress).toBe("circle-half");
    expect(statusIcon.pending).toBe("circle");
    expect(statusIcon.no_submission).toBe("minus");
  });

  it("uses a distinct glyph per status so color is never the only cue", () => {
    const glyphs = Object.values(statusIcon);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});

describe("statusColor", () => {
  it("points every StudentGradingStatus at its --rs-status-* token", () => {
    expect(statusColor.graded).toBe("var(--rs-status-graded)");
    expect(statusColor.autograded).toBe("var(--rs-status-autograded)");
    expect(statusColor.in_progress).toBe("var(--rs-status-in-progress)");
    expect(statusColor.pending).toBe("var(--rs-status-pending)");
    expect(statusColor.no_submission).toBe("var(--rs-status-no-submission)");
  });

  it("contains no hardcoded hex colors", () => {
    for (const value of Object.values(statusColor)) {
      expect(value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});

describe("effectiveViewMode", () => {
  type ViewMode = "cards" | "table";

  it("forces the demo view mode while the demo tour runs even when the stored mode differs", () => {
    expect(effectiveViewMode<ViewMode>(true, "table", "cards")).toBe("cards");
  });

  it("keeps the demo view mode when the stored mode already matches", () => {
    expect(effectiveViewMode<ViewMode>(true, "cards", "cards")).toBe("cards");
  });

  it("returns the stored mode when the demo tour is not running", () => {
    expect(effectiveViewMode<ViewMode>(false, "table", "cards")).toBe("table");
    expect(effectiveViewMode<ViewMode>(false, "cards", "cards")).toBe("cards");
  });
});
