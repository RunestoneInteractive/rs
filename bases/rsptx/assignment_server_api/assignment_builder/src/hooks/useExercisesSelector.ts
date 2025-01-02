import { useToastContext } from "@components/ui/ToastContext";
import {
  useGetExercisesQuery,
  useRemoveAssignmentExercisesMutation
} from "@store/assignmentExercise/assignmentExercise.logic.api";
import { exercisesActions, exercisesSelectors } from "@store/exercises/exercises.logic";
import { readingsSelectors } from "@store/readings/readings.logic";
import { useDispatch, useSelector } from "react-redux";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { Chapter } from "@/types/createExerciseForm";
import { getExercisesWithoutReadings } from "@/utils/exercise";

export const useExercisesSelector = () => {
  const dispatch = useDispatch();
  const { selectedAssignment } = useSelectedAssignment();
  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);
  const [removeExercisesPost] = useRemoveAssignmentExercisesMutation();
  const { showToast } = useToastContext();
  const availableExercises = useSelector(readingsSelectors.getAvailableReadings);

  const {
    isLoading: isExercisesLoading,
    isError: isExercisesError,
    data: exercises = [],
    refetch: refetchExercises
  } = useGetExercisesQuery(selectedAssignment!.id);

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
      showToast({
        severity: "success",
        summary: "Success",
        detail: `${idsToRemove.length} exercises successfully removed`
      });
      dispatch(
        exercisesActions.setSelectedExercises(
          selectedExercises.filter((r) => !idsToRemove.includes(r.id))
        )
      );
    }
  };

  if (isExercisesLoading) {
    return { loading: true, removeExercises };
  }

  if (!exercises || isExercisesError) {
    return { error: true, refetch, removeExercises };
  }

  const chapters: Array<Chapter> = availableExercises.map((node) => {
    return {
      key: node.key as string,
      label: node.data.title as string
    };
  });

  return {
    assignmentExercises,
    removeExercises,
    chapters
  };
};
