import { useToastContext } from "@components/ui/ToastContext";
import { assignmentExerciseSelectors } from "@store/assignmentExercise/assignmentExercise.logic";
import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { useCallback } from "react";
import { useSelector } from "react-redux";

import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

export const useUpdateExercises = () => {
  const { showToast } = useToastContext();
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const assignmentExercises = useSelector(assignmentExerciseSelectors.getAssignmentExercises);

  const handleChange = useCallback(
    async (rowIndex: number, fieldName: DraggingExerciseColumns, value: string | number) => {
      if (value === assignmentExercises[rowIndex][fieldName]) {
        return;
      }

      const updatedExercise: Exercise = {
        ...assignmentExercises[rowIndex],
        [fieldName]: value
      };

      const { error } = await updateExercises([updatedExercise]);

      if (!error) {
        showToast({
          severity: "success",
          summary: "Success",
          detail: "Exercise updated successfully"
        });
      } else {
        showToast({
          severity: "error",
          summary: "Error",
          detail: "Failed to update exercise"
        });
      }
    },
    [assignmentExercises, showToast, updateExercises]
  );

  return { handleChange };
};
