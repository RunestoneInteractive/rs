import { notify } from "@components/ui/notify";
import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { useCallback } from "react";

import { useReadingsSelector } from "@/hooks/useReadingsSelector";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

export const useUpdateReadings = () => {
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const { readingExercises = [] } = useReadingsSelector();

  const handleChange = useCallback(
    async (readingId: number, fieldName: DraggingExerciseColumns, value: string | number) => {
      const readingToUpdate = readingExercises.find((reading) => reading.id === readingId);

      if (!readingToUpdate) {
        notify.error("This reading is no longer in the assignment");
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
        notify.success("Reading updated");
      } else {
        notify.error("Couldn't update reading. Try again.");
      }
    },
    [readingExercises, updateExercises]
  );

  return { handleChange };
};
