import { notify } from "@components/ui/notify";
import { assignmentSelectors } from "@store/assignment/assignment.logic";
import { assignmentExerciseSelectors } from "@store/assignmentExercise/assignmentExercise.logic";
import {
  useGetExercisesQuery,
  useRemoveAssignmentExercisesMutation
} from "@store/assignmentExercise/assignmentExercise.logic.api";
import { exercisesActions, exercisesSelectors } from "@store/exercises/exercises.logic";
import { readingsSelectors } from "@store/readings/readings.logic";
import { useDispatch, useSelector } from "react-redux";

import { Chapter } from "@/types/createExerciseForm";
import { getExercisesWithoutReadings } from "@/utils/exercise";

export const useExercisesSelector = () => {
  const dispatch = useDispatch();
  const selectedAssignmentId = useSelector(assignmentSelectors.getSelectedAssignmentId);
  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);
  const [removeExercisesPost] = useRemoveAssignmentExercisesMutation();
  const availableExercises = useSelector(readingsSelectors.getAvailableReadings);
  const exercises = useSelector(assignmentExerciseSelectors.getAssignmentExercises);

  const exercisesForAssignmentId = useSelector(
    assignmentExerciseSelectors.getExercisesForAssignmentId
  );

  const {
    isLoading: isExercisesLoading,
    isFetching: isExercisesFetching,
    isError: isExercisesError,
    refetch: refetchExercises
  } = useGetExercisesQuery(selectedAssignmentId ?? 0, {
    skip: !selectedAssignmentId,
    refetchOnMountOrArgChange: true
  });

  const isStaleForAssignment = exercisesForAssignmentId !== (selectedAssignmentId ?? null);

  // True only once the exercises in the store belong to this assignment and have
  // settled. Deep-link resolution depends on it: an empty list on the first render
  // — before the route's assignment id reaches the store, so the query hasn't even
  // started — is not evidence that an exercise id is missing.
  const exercisesReady =
    selectedAssignmentId != null &&
    exercisesForAssignmentId === selectedAssignmentId &&
    !isExercisesFetching;

  const assignmentExercises = getExercisesWithoutReadings(exercises);

  const refetch = () => {
    refetchExercises();
  };

  const removeExercises = async (toRemove: Array<{ id: number }>) => {
    const idsToRemove = toRemove.map((item) => item.id);

    if (!idsToRemove.length) {
      return;
    }

    const { error } = await removeExercisesPost(idsToRemove);

    if (!error) {
      notify.success(
        `Removed ${idsToRemove.length} ${idsToRemove.length === 1 ? "exercise" : "exercises"}`
      );
      dispatch(
        exercisesActions.setSelectedExercises(
          selectedExercises.filter((r) => !idsToRemove.includes(r.id))
        )
      );
    }
  };

  if (isExercisesLoading || (isExercisesFetching && isStaleForAssignment)) {
    return { loading: true, removeExercises };
  }

  if (!exercises || isExercisesError) {
    return { error: true, refetch, removeExercises };
  }

  const chapters: Array<Chapter> = availableExercises.map((node) => {
    return {
      value: node.key as string,
      label: node.data.title as string
    };
  });

  return {
    assignmentExercises,
    removeExercises,
    chapters,
    exercisesReady,
    isExercisesLoading,
    isExercisesError: isExercisesError || !selectedAssignmentId,
    refetchExercises
  };
};
