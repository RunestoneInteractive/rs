import { useToastContext } from "@components/ui/ToastContext";
import { assignmentSelectors } from "@store/assignment/assignment.logic";
import {
  useGetExercisesQuery,
  useRemoveAssignmentExercisesMutation,
  useUpdateAssignmentExerciseMutation
} from "@store/assignment/assignment.logic.api";
import { readingsActions, readingsSelectors } from "@store/readings/readings.logic";
import sortBy from "lodash/sortBy";
import { TreeNode } from "primereact/treenode";
import { TreeTableEvent } from "primereact/treetable";
import { useDispatch, useSelector } from "react-redux";

export const useReadingsSelector = () => {
  const dispatch = useDispatch();
  const selectedReadings = useSelector(readingsSelectors.getSelectedReadings);
  const selectedAssignment = useSelector(assignmentSelectors.getSelectedAssignment);
  const [addReadingPost] = useUpdateAssignmentExerciseMutation();
  const [removeReadingsPost] = useRemoveAssignmentExercisesMutation();
  const { showToast } = useToastContext();
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

  const addReadings = async ({ node }: Omit<TreeTableEvent, "originalEvent">) => {
    if (!selectedAssignment) {
      return;
    }

    let count = 0;
    const promises: Promise<void>[] = [];

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const processNode = ({ node }: Omit<TreeTableEvent, "originalEvent">) => {
      const { data, children } = node;

      if (children) {
        children.forEach((child) => processNode({ node: child }));
        return;
      }

      const readingExercisesLength = readingExercises.length;

      const promise = addReadingPost({
        assignment_id: selectedAssignment.id,
        points: readingExercisesLength ? readingExercises[readingExercisesLength - 1].points : 1,
        sorting_priority: readingExercisesLength + count,
        reading_assignment: true,
        autograde: "interaction",
        which_to_grade: "best_answer",
        activities_required: Math.round(data.numQuestions * 0.8),
        required: !!Math.round(data.numQuestions * 0.8),
        chapter: data.chapter,
        id: data.id,
        question_id: data.id,
        num: data.num,
        numQuestions: data.numQuestions,
        subchapter: data.subchapter,
        title: data.title
      }).then(() => {
        count++;
      });

      promises.push(promise);
    };

    processNode({ node });

    await Promise.all(promises);

    showToast({
      severity: "success",
      summary: "Success",
      detail: `${count} readings successfully added`
    });
  };

  const removeReadings = async (toRemove: Array<{ id: number }>) => {
    const idsToRemove = toRemove.map((item) => item.id);

    const { error } = await removeReadingsPost(idsToRemove);

    if (!error) {
      showToast({
        severity: "success",
        summary: "Success",
        detail: `${idsToRemove.length} exercises successfully removed`
      });
      dispatch(
        readingsActions.setSelectedReadings(
          selectedReadings.filter((r) => !idsToRemove.includes(r.id))
        )
      );
    }
  };

  const removeReadingsFromAvailableReadings = async ({ node }: TreeTableEvent) => {
    const { data, children } = node;

    if (children) {
      const ids = children.map((child) => Number(child.data.id));

      await removeReadings(assignmentExercises.filter((ex) => ids.includes(ex.question_id)));
      return;
    }

    await removeReadings(assignmentExercises.filter((ex) => data.id === ex.question_id));
  };

  return {
    readingExercises,
    selectedKeys: {
      ...Object.fromEntries(subchapterSelectionKeys),
      ...Object.fromEntries(chapterSelectionKeys)
    },
    addReadings,
    removeReadings,
    removeReadingsFromAvailableReadings
  };
};
