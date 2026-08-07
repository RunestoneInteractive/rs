import type {
  GradebookAssignment,
  GradebookCell,
  GradebookStudent,
  StudentAssignmentQuestionScore
} from "@store/grader/grader.logic.api";

export const cellKey = (sid: string, assignmentId: number): string => `${sid}:${assignmentId}`;

export const buildCellLookup = (cells: GradebookCell[]): Map<string, GradebookCell> => {
  const lookup = new Map<string, GradebookCell>();
  for (const cell of cells) {
    lookup.set(cellKey(cell.sid, cell.assignment_id), cell);
  }
  return lookup;
};

export const getCell = (
  lookup: Map<string, GradebookCell>,
  sid: string,
  assignmentId: number
): GradebookCell | undefined => lookup.get(cellKey(sid, assignmentId));

export const getCellScore = (
  lookup: Map<string, GradebookCell>,
  sid: string,
  assignmentId: number
): number | null => {
  const cell = lookup.get(cellKey(sid, assignmentId));
  return cell ? cell.score : null;
};

export const isCellManual = (
  lookup: Map<string, GradebookCell>,
  sid: string,
  assignmentId: number
): boolean => !!lookup.get(cellKey(sid, assignmentId))?.manual_total;

export const assignmentAverage = (cells: GradebookCell[], assignmentId: number): number | null => {
  const scores = cells
    .filter((c) => c.assignment_id === assignmentId && c.score != null)
    .map((c) => c.score as number);
  if (scores.length === 0) return null;
  const total = scores.reduce((sum, s) => sum + s, 0);
  return Math.round((total / scores.length) * 100) / 100;
};

export const studentTotal = (
  lookup: Map<string, GradebookCell>,
  assignments: GradebookAssignment[],
  sid: string
): number | null => {
  let total = 0;
  let graded = false;
  for (const assignment of assignments) {
    const score = getCellScore(lookup, sid, assignment.id);
    if (score != null) {
      total += score;
      graded = true;
    }
  }
  return graded ? Math.round(total * 100) / 100 : null;
};

export const formatScore = (score: number | null | undefined): string => {
  if (score == null) return "—";
  return Number.isInteger(score) ? String(score) : String(Math.round(score * 100) / 100);
};

/**
 * Rows the student filter leaves visible. The sid is matched as well as the
 * display name because a student whose name is missing shows up as their
 * username.
 */
export const filterStudents = (students: GradebookStudent[], query: string): GradebookStudent[] => {
  const needle = query.trim().toLowerCase();

  if (!needle) return students;
  return students.filter(
    (s) => s.name.toLowerCase().includes(needle) || s.sid.toLowerCase().includes(needle)
  );
};

/**
 * Columns the assignment filter leaves visible. An empty selection means "all
 * assignments" rather than "none", so clearing the picker restores the full
 * gradebook.
 */
export const filterAssignments = (
  assignments: GradebookAssignment[],
  selectedIds: number[]
): GradebookAssignment[] => {
  if (selectedIds.length === 0) return assignments;
  const wanted = new Set(selectedIds);

  return assignments.filter((a) => wanted.has(a.id));
};

/** Sum of the question scores that have actually been graded. */
export const questionScoreSum = (questions: StudentAssignmentQuestionScore[]): number =>
  questions.reduce((sum, q) => (q.score == null ? sum : sum + q.score), 0);

/**
 * True when the recorded assignment total disagrees with the question scores it
 * is supposed to roll up. A hand-entered total is *expected* to differ, so it
 * never counts as stale; a computed one that differs is simply out of date.
 */
export const isTotalStale = (
  questions: StudentAssignmentQuestionScore[],
  totalScore: number | null | undefined,
  manualTotal: boolean
): boolean => {
  if (manualTotal) return false;
  const scored = questions.filter((q) => q.score != null);

  if (scored.length === 0) return false;
  const sum = questionScoreSum(scored);

  if (totalScore == null) return sum > 0;
  return Math.abs(sum - totalScore) > 0.01;
};
