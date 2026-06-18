import type {
  GradebookAssignment,
  GradebookCell
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

export const assignmentAverage = (
  cells: GradebookCell[],
  assignmentId: number
): number | null => {
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
