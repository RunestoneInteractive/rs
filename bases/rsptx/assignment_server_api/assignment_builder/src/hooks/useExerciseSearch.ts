import { assignmentSelectors } from "@store/assignment/assignment.logic";
import { useUpdateAssignmentExerciseMutation } from "@store/assignment/assignment.logic.api";
import { useSearchExercisesQuery } from "@store/exercises/exercises.logic.api";
import last from "lodash/last";
import { useSelector } from "react-redux";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Exercise } from "@/types/exercises";

export const useExerciseSearch = () => {
  const selectedAssignment = useSelector(assignmentSelectors.getSelectedAssignment);
  const { assignmentExercises = [] } = useExercisesSelector();
  const [addExercisesPost] = useUpdateAssignmentExerciseMutation();
  const {
    isLoading: loading,
    isError: error,
    data: exercises = [],
    refetch
  } = useSearchExercisesQuery({
    author: "",
    // TODO: Change endpoint to get boolean instead of string: RUN-15
    base_course: "true",
    question_type: "",
    source_regex: ""
  });

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
    loading,
    error,
    exercises: exercises.filter(
      (e) => !assignmentExercises.some((assignmentExercise) => assignmentExercise.id === e.id)
    ),
    refetch,
    addExerciseToAssignment
  };
};
