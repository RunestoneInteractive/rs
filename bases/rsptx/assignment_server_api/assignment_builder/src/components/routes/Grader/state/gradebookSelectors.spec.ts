import type {
  GradebookAssignment,
  GradebookCell,
  GradebookStudent,
  StudentAssignmentQuestionScore
} from "@store/grader/grader.logic.api";

import {
  assignmentAverage,
  buildCellLookup,
  cellKey,
  columnUnitLabel,
  displayScore,
  filterAssignments,
  filterStudents,
  formatScore,
  getCell,
  getCellScore,
  isCellManual,
  isTotalStale,
  questionScoreSum,
  studentTotal,
  studentTotalDisplay
} from "./gradebookSelectors";

const assignments: GradebookAssignment[] = [
  { id: 1, name: "A1", points: 10, duedate: null, released: true },
  { id: 2, name: "A2", points: 5, duedate: null, released: false }
];

const cells: GradebookCell[] = [
  { sid: "s1", assignment_id: 1, score: 8, released: true, manual_total: true },
  { sid: "s1", assignment_id: 2, score: 5, released: false },
  { sid: "s2", assignment_id: 1, score: 6, released: true },
  { sid: "s2", assignment_id: 2, score: null, released: false }
];

describe("cellKey", () => {
  it("joins sid and assignment id", () => {
    expect(cellKey("s1", 3)).toBe("s1:3");
  });
});

describe("buildCellLookup / getCellScore", () => {
  it("resolves a present score", () => {
    const lookup = buildCellLookup(cells);
    expect(getCellScore(lookup, "s1", 1)).toBe(8);
  });

  it("returns null for a missing cell", () => {
    const lookup = buildCellLookup(cells);
    expect(getCellScore(lookup, "s9", 1)).toBeNull();
  });

  it("returns null for an explicit null score", () => {
    const lookup = buildCellLookup(cells);
    expect(getCellScore(lookup, "s2", 2)).toBeNull();
  });
});

describe("getCell / isCellManual", () => {
  it("returns the full cell for a present (sid, assignment)", () => {
    const lookup = buildCellLookup(cells);
    expect(getCell(lookup, "s1", 1)?.score).toBe(8);
  });

  it("returns undefined for a missing cell", () => {
    const lookup = buildCellLookup(cells);
    expect(getCell(lookup, "s9", 1)).toBeUndefined();
  });

  it("flags a manual cell", () => {
    const lookup = buildCellLookup(cells);
    expect(isCellManual(lookup, "s1", 1)).toBe(true);
  });

  it("reports non-manual for a cell without the flag", () => {
    const lookup = buildCellLookup(cells);
    expect(isCellManual(lookup, "s1", 2)).toBe(false);
  });

  it("reports non-manual for a missing cell", () => {
    const lookup = buildCellLookup(cells);
    expect(isCellManual(lookup, "s9", 1)).toBe(false);
  });
});

describe("assignmentAverage", () => {
  it("averages only non-null scores", () => {
    expect(assignmentAverage(cells, 1)).toBe(7);
  });

  it("ignores null scores in the denominator", () => {
    expect(assignmentAverage(cells, 2)).toBe(5);
  });

  it("returns null when no scores exist", () => {
    expect(assignmentAverage(cells, 99)).toBeNull();
  });

  it("rounds to two decimals", () => {
    const data: GradebookCell[] = [
      { sid: "a", assignment_id: 7, score: 1, released: true },
      { sid: "b", assignment_id: 7, score: 2, released: true }
    ];
    expect(assignmentAverage(data, 7)).toBe(1.5);
  });
});

describe("studentTotal", () => {
  it("sums a student's scores across assignments", () => {
    const lookup = buildCellLookup(cells);
    expect(studentTotal(lookup, assignments, "s1")).toBe(13);
  });

  it("treats missing scores as zero but still totals graded ones", () => {
    const lookup = buildCellLookup(cells);
    expect(studentTotal(lookup, assignments, "s2")).toBe(6);
  });

  it("returns null when the student has no graded cells", () => {
    const lookup = buildCellLookup([{ sid: "s3", assignment_id: 1, score: null, released: true }]);
    expect(studentTotal(lookup, assignments, "s3")).toBeNull();
  });
});

describe("displayScore", () => {
  it("returns the raw score in points mode", () => {
    expect(displayScore(8, 10, true)).toBe(8);
  });

  it("converts to a percent of the assignment's points", () => {
    expect(displayScore(8, 10, false)).toBe(80);
  });

  it("rounds a percent to two decimals", () => {
    expect(displayScore(1, 3, false)).toBe(33.33);
  });

  it("passes the raw score through when the assignment is worth nothing", () => {
    expect(displayScore(2, 0, false)).toBe(2);
  });

  it("stays null for an ungraded cell", () => {
    expect(displayScore(null, 10, false)).toBeNull();
    expect(displayScore(undefined, 10, true)).toBeNull();
  });
});

describe("studentTotalDisplay", () => {
  it("sums points in points mode", () => {
    const lookup = buildCellLookup(cells);
    expect(studentTotalDisplay(lookup, assignments, "s1", true)).toBe(13);
  });

  it("reports a percent of the points available across graded assignments", () => {
    const lookup = buildCellLookup(cells);
    expect(studentTotalDisplay(lookup, assignments, "s1", false)).toBe(86.67);
  });

  it("leaves ungraded assignments out of the denominator", () => {
    const lookup = buildCellLookup(cells);
    // s2 was graded only on the 10 point A1, so 6/10 rather than 6/15.
    expect(studentTotalDisplay(lookup, assignments, "s2", false)).toBe(60);
  });

  it("returns null when the student has no graded cells", () => {
    const lookup = buildCellLookup([{ sid: "s3", assignment_id: 1, score: null, released: true }]);
    expect(studentTotalDisplay(lookup, assignments, "s3", false)).toBeNull();
  });
});

describe("columnUnitLabel", () => {
  it("names the points available in points mode", () => {
    expect(columnUnitLabel(10, true)).toBe(" / 10");
  });

  it("marks the column as a percent otherwise", () => {
    expect(columnUnitLabel(10, false)).toBe(" %");
  });
});

describe("formatScore", () => {
  it("renders an em dash for null", () => {
    expect(formatScore(null)).toBe("—");
  });

  it("renders integers without decimals", () => {
    expect(formatScore(8)).toBe("8");
  });

  it("rounds fractional scores to two decimals", () => {
    expect(formatScore(7.333)).toBe("7.33");
  });
});

describe("filterStudents", () => {
  const students: GradebookStudent[] = [
    { sid: "ada@example.com", name: "Ada Lovelace" },
    { sid: "turing", name: "Alan Turing" },
    { sid: "nameless", name: "nameless" }
  ];

  it("returns everyone for an empty query", () => {
    expect(filterStudents(students, "   ")).toHaveLength(3);
  });

  it("matches the display name case-insensitively", () => {
    expect(filterStudents(students, "LOVELACE").map((s) => s.sid)).toEqual(["ada@example.com"]);
  });

  it("matches on the sid so a student with no name is still findable", () => {
    expect(filterStudents(students, "ada@").map((s) => s.sid)).toEqual(["ada@example.com"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterStudents(students, "grace")).toEqual([]);
  });
});

describe("filterAssignments", () => {
  it("treats an empty selection as all assignments", () => {
    expect(filterAssignments(assignments, [])).toHaveLength(2);
  });

  it("keeps only the selected columns, in gradebook order", () => {
    expect(filterAssignments(assignments, [2]).map((a) => a.id)).toEqual([2]);
    expect(filterAssignments(assignments, [2, 1]).map((a) => a.id)).toEqual([1, 2]);
  });

  it("ignores ids that are not in the gradebook", () => {
    expect(filterAssignments(assignments, [99])).toEqual([]);
  });
});

describe("questionScoreSum / isTotalStale", () => {
  const graded: StudentAssignmentQuestionScore[] = [
    { id: 1, name: "q1", points: 5, score: 5 },
    { id: 2, name: "q2", points: 5, score: 3 },
    { id: 3, name: "q3", points: 5, score: null }
  ];

  it("sums only the graded questions", () => {
    expect(questionScoreSum(graded)).toBe(8);
  });

  it("is not stale when the total matches the questions", () => {
    expect(isTotalStale(graded, 8, false)).toBe(false);
  });

  it("is stale when the total disagrees with the questions", () => {
    expect(isTotalStale(graded, 2, false)).toBe(true);
  });

  it("tolerates floating point noise", () => {
    expect(isTotalStale(graded, 8.001, false)).toBe(false);
  });

  it("is stale when scores exist but no total was recorded", () => {
    expect(isTotalStale(graded, null, false)).toBe(true);
  });

  it("is never stale for a hand-entered total", () => {
    expect(isTotalStale(graded, 2, true)).toBe(false);
  });

  it("is not stale when nothing has been graded", () => {
    expect(isTotalStale([{ id: 1, name: "q1", points: 5, score: null }], null, false)).toBe(false);
  });
});
