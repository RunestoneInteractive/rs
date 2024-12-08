import { assignmentSelectors } from "@store/assignment/assignment.logic";
import {
  useGetExercisesQuery,
  useRemoveAssignmentExercisesMutation
} from "@store/assignment/assignment.logic.api";
import { exercisesActions, exercisesSelectors } from "@store/exercises/exercises.logic";
import { useGetAvailableReadingsQuery } from "@store/readings/readings.logic.api";
import { useDispatch, useSelector } from "react-redux";

import { Chapter } from "@/types/createExerciseForm";

export const useExercisesSelector = () => {
  const dispatch = useDispatch();
  const selectedAssignment = useSelector(assignmentSelectors.getSelectedAssignment);
  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);
  const [removeExercisesPost] = useRemoveAssignmentExercisesMutation();

  const {
    isLoading: isExercisesLoading,
    isError: isExercisesError,
    data: exercises,
    refetch: refetchExercises
  } = useGetExercisesQuery(selectedAssignment!.id);

  const {
    isLoading: isAvailableExercisesLoading,
    isError: isAvailableExercisesError,
    data: availableExercises,
    refetch: refetchAvailableExercises
  } = useGetAvailableReadingsQuery({
    skipreading: false,
    from_source_only: true,
    pages_only: false
  });

  const refetch = () => {
    refetchExercises();
    refetchAvailableExercises();
  };

  if (isExercisesLoading || isAvailableExercisesLoading) {
    return { loading: true };
  }

  if (!exercises || isExercisesError || !availableExercises || isAvailableExercisesError) {
    return { error: true, refetch };
  }

  const assignmentExercises = exercises.filter((ex) => !ex.reading_assignment);

  const chapters: Array<Chapter> = availableExercises.map((node) => {
    return {
      key: node.key as string,
      label: node.data.title as string
    };
  });

  const removeExercises = (toRemove: Array<{ id: number }>) => {
    const idsToRemove = toRemove.map((item) => item.id);

    removeExercisesPost(idsToRemove);
    dispatch(
      exercisesActions.setSelectedExercises(
        selectedExercises.filter((r) => !idsToRemove.includes(r.id))
      )
    );
  };

  return {
    assignmentExercises,
    availableExercises,
    chapters,
    removeExercises
  };
};
