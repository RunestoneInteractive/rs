import { notify } from "@components/ui/notify";
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
    async (exerciseId: number, fieldName: DraggingExerciseColumns, value: string | number) => {
      const exerciseToUpdate = assignmentExercises.find((ex) => ex.id === exerciseId);

      if (!exerciseToUpdate) {
        notify.error("This exercise is no longer in the assignment");
        return;
      }

      if (value === exerciseToUpdate[fieldName]) {
        return;
      }

      const updatedExercise: Exercise = {
        ...exerciseToUpdate,
        question_json: JSON.stringify(exerciseToUpdate.question_json),
        [fieldName]: value
      };

      const { error } = await updateExercises([updatedExercise]);

      if (!error) {
        notify.success("Exercise updated");
      } else {
        notify.error("Couldn't update exercise. Try again.");
      }
    },
    [assignmentExercises, updateExercises]
  );

  return { handleChange };
};
