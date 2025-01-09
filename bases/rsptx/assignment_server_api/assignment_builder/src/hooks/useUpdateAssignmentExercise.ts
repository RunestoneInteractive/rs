import { useToastContext } from "@components/ui/ToastContext";
import { useUpdateAssignmentExercisesMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { UpdateAssignmentExercisesPayload } from "@/types/exercises";

export const useUpdateAssignmentExercise = () => {
  const { selectedAssignment } = useSelectedAssignment();
  const [updateAssignmentExercisesPut] = useUpdateAssignmentExercisesMutation();
  const { showToast } = useToastContext();

  const updateAssignmentExercises = async (
    {
      idsToAdd = [],
      idsToRemove = [],
      isReading
    }: Omit<UpdateAssignmentExercisesPayload, "assignmentId">,
    onSuccess: Awaited<VoidFunction> | VoidFunction = () => {}
  ) => {
    if (!idsToAdd.length && !idsToRemove.length) {
      return;
    }

    const response = await updateAssignmentExercisesPut({
      assignmentId: selectedAssignment!.id,
      isReading,
      idsToAdd,
      idsToRemove
    });

    if (response.error) {
      showToast({
        severity: "error",
        summary: "Error",
        detail: "Failed to update exercises"
      });
      return;
    }

    showToast({
      severity: "success",
      summary: "Success",
      detail: `${!!idsToAdd.length ? `${idsToAdd.length} exercises successfully added` : ""}
${!!idsToRemove.length && !!idsToAdd.length ? ", " : ""}
${!!idsToRemove.length ? `${idsToRemove.length} exercises successfully removed` : ""}`
    });

    await onSuccess();

    return response;
  };

  return {
    updateAssignmentExercises
  };
};
