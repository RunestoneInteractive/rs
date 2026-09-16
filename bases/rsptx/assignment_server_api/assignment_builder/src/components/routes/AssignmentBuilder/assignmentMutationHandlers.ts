import { Assignment } from "@/types/assignment";
import { notify } from "@components/ui/notify";
import { BulkActionResult } from "@store/assignment/assignment.logic.api";
import { getVisibilityMode } from "./components/edit/visibilityMode";

export interface VisibilityUpdate {
  visible: boolean;
  visible_on: string | null;
  hidden_on: string | null;
}

interface UnwrappableResult {
  unwrap: () => Promise<unknown>;
}

export type UpdateAssignmentTrigger = (assignment: Assignment) => UnwrappableResult;

export const getEnforceDueToastCopy = (enforceDue: boolean): string =>
  enforceDue ? "Late submissions not allowed" : "Late submissions allowed";

export const getVisibilityToastCopy = (update: VisibilityUpdate): string => {
  const mode = getVisibilityMode(update.visible, update.visible_on, update.hidden_on);

  if (mode === "visible") {
    return "Assignment is now visible";
  }
  if (mode === "hidden") {
    return "Assignment is now hidden";
  }
  return "Assignment visibility is scheduled";
};

const unwrapSucceeded = (result: UnwrappableResult): Promise<boolean> =>
  result.unwrap().then(
    () => true,
    () => false
  );

export const saveEnforceDue = async (
  updateAssignment: UpdateAssignmentTrigger,
  assignment: Assignment,
  enforceDue: boolean
): Promise<void> => {
  const saved = await unwrapSucceeded(updateAssignment({ ...assignment, enforce_due: enforceDue }));

  if (saved) {
    notify.success(getEnforceDueToastCopy(enforceDue));
  }
};

export const saveVisibility = async (
  updateAssignment: UpdateAssignmentTrigger,
  assignment: Assignment,
  update: VisibilityUpdate
): Promise<void> => {
  const saved = await unwrapSucceeded(updateAssignment({ ...assignment, ...update }));

  if (saved) {
    notify.success(getVisibilityToastCopy(update));
  }
};

interface BulkUnwrappableResult {
  unwrap: () => Promise<BulkActionResult>;
}

export type BulkUpdateAssignmentsTrigger = (assignments: Assignment[]) => BulkUnwrappableResult;

const pluralizeAssignments = (count: number): string =>
  `${count} ${count === 1 ? "assignment" : "assignments"}`;

export const getBulkVisibilityToastCopy = (count: number, update: VisibilityUpdate): string => {
  const mode = getVisibilityMode(update.visible, update.visible_on, update.hidden_on);
  const subject = pluralizeAssignments(count);

  if (mode === "visible") {
    return `${subject} now visible`;
  }
  if (mode === "hidden") {
    return `${subject} now hidden`;
  }
  return `Visibility scheduled for ${subject}`;
};

export const getBulkEnforceDueToastCopy = (count: number, enforceDue: boolean): string => {
  const subject = pluralizeAssignments(count);

  return enforceDue
    ? `Late submissions not allowed for ${subject}`
    : `Late submissions allowed for ${subject}`;
};

export const getBulkUpdateErrorToastCopy = (failed: number): string =>
  `Couldn't update ${pluralizeAssignments(failed)}. Try again.`;

const runBulkUpdate = async (
  bulkUpdateAssignments: BulkUpdateAssignmentsTrigger,
  assignments: Assignment[],
  patch: Partial<Assignment>
): Promise<BulkActionResult> => {
  try {
    return await bulkUpdateAssignments(
      assignments.map((assignment) => ({ ...assignment, ...patch }))
    ).unwrap();
  } catch {
    return { succeeded: 0, failed: assignments.length };
  }
};

const notifyBulkResult = (result: BulkActionResult, successCopy: string): void => {
  if (result.succeeded > 0) {
    notify.success(successCopy);
  }
  if (result.failed > 0) {
    notify.error(getBulkUpdateErrorToastCopy(result.failed));
  }
};

export const saveBulkVisibility = async (
  bulkUpdateAssignments: BulkUpdateAssignmentsTrigger,
  assignments: Assignment[],
  update: VisibilityUpdate
): Promise<void> => {
  if (assignments.length === 0) {
    return;
  }
  const result = await runBulkUpdate(bulkUpdateAssignments, assignments, update);

  notifyBulkResult(result, getBulkVisibilityToastCopy(result.succeeded, update));
};

export const saveBulkEnforceDue = async (
  bulkUpdateAssignments: BulkUpdateAssignmentsTrigger,
  assignments: Assignment[],
  enforceDue: boolean
): Promise<void> => {
  if (assignments.length === 0) {
    return;
  }
  const result = await runBulkUpdate(bulkUpdateAssignments, assignments, {
    enforce_due: enforceDue
  });

  notifyBulkResult(result, getBulkEnforceDueToastCopy(result.succeeded, enforceDue));
};
