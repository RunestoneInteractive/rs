import type { GradebookAssignment, GradebookCell } from "@store/grader/grader.logic.api";

import {
  assignmentAverage,
  buildCellLookup,
  cellKey,
  formatScore,
  getCell,
  getCellScore,
  isCellManual,
  studentTotal
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
