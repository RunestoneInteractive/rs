import { useSearchExercisesQuery } from "@store/exercises/exercises.logic.api";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";

export const useExerciseSearch = () => {
  const { assignmentExercises = [] } = useExercisesSelector();

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

  return {
    loading,
    error,
    exercises: exercises.filter(
      (e) => !assignmentExercises.some((assignmentExercise) => assignmentExercise.id === e.id)
    ),
    refetch
  };
};
