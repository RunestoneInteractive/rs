import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

export const useUpdateExercises = () => {
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const { assignmentExercises = [] } = useExercisesSelector();

  const handleChange = (
    rowIndex: number,
    fieldName: DraggingExerciseColumns,
    value: string | number
  ) => {
    const updatedExercise: Exercise = {
      ...assignmentExercises[rowIndex],
      [fieldName]: value
    };

    updateExercises([updatedExercise]);
  };

  return { handleChange };
};
