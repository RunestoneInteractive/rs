import { useGetExercisesQuery } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { readingsSelectors } from "@store/readings/readings.logic";
import sortBy from "lodash/sortBy";
import { TreeNode } from "primereact/treenode";
import { useSelector } from "react-redux";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";

export const useReadingsSelector = () => {
  const { selectedAssignment } = useSelectedAssignment();
  const availableReadings = useSelector(readingsSelectors.getAvailableReadings);

  const {
    isLoading: isExercisesLoading,
    isError: isExercisesError,
    data: assignmentExercises,
    refetch: refetchExercises
  } = useGetExercisesQuery(selectedAssignment!.id);

  const refetch = () => {
    refetchExercises();
  };

  if (isExercisesLoading) {
    return { loading: true };
  }

  if (!assignmentExercises || isExercisesError) {
    return { error: true, refetch };
  }

  const readingExercises = sortBy(
    assignmentExercises.filter((ex) => ex.reading_assignment),
    (exercise) => exercise.sorting_priority
  );

  const assignmentExercisesSubchapters = readingExercises.map(
    (assignmentExercise) => assignmentExercise.subchapter
  );

  const subchapterSelectionKeys = assignmentExercisesSubchapters.map((subchapter) => [
    subchapter,
    { checked: true, partialChecked: false }
  ]);

  const chapterSelectionKeys = availableReadings.map((chapter: TreeNode) => [
    chapter.key,
    {
      checked: chapter.children!.every((child) =>
        assignmentExercisesSubchapters.includes(child.key as string)
      ),
      partialChecked: chapter.children!.some((child) =>
        assignmentExercisesSubchapters.includes(child.key as string)
      )
    }
  ]);

  return {
    readingExercises,
    selectedKeys: {
      ...Object.fromEntries(subchapterSelectionKeys),
      ...Object.fromEntries(chapterSelectionKeys)
    }
  };
};
