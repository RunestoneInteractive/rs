import { assignmentExerciseSelectors } from "@store/assignmentExercise/assignmentExercise.logic";
import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { useCallback } from "react";
import { useSelector } from "react-redux";

import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

export const useUpdateExercises = () => {
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const assignmentExercises = useSelector(assignmentExerciseSelectors.getAssignmentExercises);

  const handleChange = useCallback(
    (rowIndex: number, fieldName: DraggingExerciseColumns, value: string | number) => {
      const updatedExercise: Exercise = {
        ...assignmentExercises[rowIndex],
        [fieldName]: value
      };

      updateExercises([updatedExercise]);
    },
    [assignmentExercises, updateExercises]
  );

  return { handleChange };
};
