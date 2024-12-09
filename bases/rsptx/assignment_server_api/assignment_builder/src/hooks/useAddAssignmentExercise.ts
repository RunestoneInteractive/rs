import { assignmentSelectors } from "@store/assignment/assignment.logic";
import {
  useGetExercisesQuery,
  useUpdateAssignmentExerciseMutation
} from "@store/assignment/assignment.logic.api";
import last from "lodash/last";
import { useSelector } from "react-redux";

import { Exercise } from "@/types/exercises";

export const useAddAssignmentExercise = () => {
  const selectedAssignment = useSelector(assignmentSelectors.getSelectedAssignment);
  const { data: exercises = [] } = useGetExercisesQuery(selectedAssignment!.id);
  const [addExercisesPost] = useUpdateAssignmentExerciseMutation();

  const assignmentExercises = exercises.filter((ex) => !ex.reading_assignment);

  const addExerciseToAssignment = async (selectedExercises: Exercise[]) => {
    const { points, autograde, which_to_grade, sorting_priority, reading_assignment } = last(
      assignmentExercises
    ) ?? {
      points: 1,
      autograde: "pct_correct",
      which_to_grade: "best_answer",
      sorting_priority: assignmentExercises?.length ?? 0,
      reading_assignment: false
    };

    //TODO: Make one request only RUN-15
    const response = await Promise.all(
      selectedExercises.map((ex: Exercise) => {
        return addExercisesPost({
          ...ex,
          assignment_id: selectedAssignment!.id,
          question_id: ex.id,
          points,
          autograde,
          which_to_grade,
          sorting_priority,
          reading_assignment
        });
      })
    );

    return response;
  };

  return {
    addExerciseToAssignment
  };
};
