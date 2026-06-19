import { notify } from "@components/ui/notify";
import { useUpdateAssignmentExercisesMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { UpdateAssignmentExercisesPayload } from "@/types/exercises";

const exerciseNoun = (count: number) => (count === 1 ? "exercise" : "exercises");

export const getExercisesUpdateMessage = (addedCount: number, removedCount: number): string => {
  if (addedCount && removedCount) {
    return `Added ${addedCount}, removed ${removedCount} ${exerciseNoun(removedCount)}`;
  }
  if (addedCount) {
    return `Added ${addedCount} ${exerciseNoun(addedCount)}`;
  }
  return `Removed ${removedCount} ${exerciseNoun(removedCount)}`;
};

export const useUpdateAssignmentExercise = () => {
  const { selectedAssignment } = useSelectedAssignment();
  const [updateAssignmentExercisesPut, { isLoading: isUpdating }] =
    useUpdateAssignmentExercisesMutation();

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
      notify.error("Couldn't update exercises. Try again.");
      return;
    }

    notify.success(getExercisesUpdateMessage(idsToAdd.length, idsToRemove.length));

    await onSuccess();

    return response;
  };

  return {
    updateAssignmentExercises,
    isUpdating
  };
};
