import { useToastContext } from "@components/ui/ToastContext";
import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { useCallback } from "react";

import { useReadingsSelector } from "@/hooks/useReadingsSelector";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

export const useUpdateReadings = () => {
  const { showToast } = useToastContext();
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const { readingExercises = [] } = useReadingsSelector();

  const handleChange = useCallback(
    async (readingId: number, fieldName: DraggingExerciseColumns, value: string | number) => {
      const readingToUpdate = readingExercises.find((reading) => reading.id === readingId);

      if (!readingToUpdate) {
        showToast({
          severity: "error",
          summary: "Error",
          detail: "Reading not found"
        });
        return;
      }

      if (value === readingToUpdate[fieldName]) {
        return;
      }

      const updatedExercise: Exercise = {
        ...readingToUpdate,
        question_json: JSON.stringify(readingToUpdate.question_json),
        [fieldName]: value
      };

      const { error } = await updateExercises([updatedExercise]);

      if (!error) {
        showToast({
          severity: "success",
          summary: "Success",
          detail: "Reading updated successfully"
        });
      } else {
        showToast({
          severity: "error",
          summary: "Error",
          detail: "Failed to update reading"
        });
      }
    },
    [readingExercises, showToast, updateExercises]
  );

  return { handleChange };
};
