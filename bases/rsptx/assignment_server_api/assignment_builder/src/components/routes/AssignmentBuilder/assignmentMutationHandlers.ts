import { Assignment } from "@/types/assignment";
import { notify } from "@components/ui/notify";

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
