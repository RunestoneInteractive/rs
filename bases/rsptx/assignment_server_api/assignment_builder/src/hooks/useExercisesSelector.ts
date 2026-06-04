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
    isExercisesLoading,
    isExercisesError: isExercisesError || !selectedAssignmentId,
    refetchExercises
  };
};
