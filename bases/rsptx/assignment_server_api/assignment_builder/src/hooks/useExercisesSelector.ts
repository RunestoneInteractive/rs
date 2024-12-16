import { assignmentSelectors } from "@store/assignment/assignment.logic";
import {
  useGetExercisesQuery,
  useRemoveAssignmentExercisesMutation
} from "@store/assignment/assignment.logic.api";
import { exercisesActions, exercisesSelectors } from "@store/exercises/exercises.logic";
import { useGetAvailableReadingsQuery } from "@store/readings/readings.logic.api";
import sortBy from "lodash/sortBy";
import { TreeNode } from "primereact/treenode";
import { TreeTableEvent } from "primereact/treetable";
import { useDispatch, useSelector } from "react-redux";

import { useAddAssignmentExercise } from "@/hooks/useAddAssignmentExercise";
import { Chapter } from "@/types/createExerciseForm";

export const useExercisesSelector = () => {
  const dispatch = useDispatch();
  const selectedAssignment = useSelector(assignmentSelectors.getSelectedAssignment);
  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);
  const [removeExercisesPost] = useRemoveAssignmentExercisesMutation();

  const { addExerciseToAssignment } = useAddAssignmentExercise();

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

  const assignmentExercises = sortBy(
    exercises.filter((ex) => !ex.reading_assignment),
    (exercise) => exercise.sorting_priority
  );

  const chapters: Array<Chapter> = availableExercises.map((node) => {
    return {
      key: node.key as string,
      label: node.data.title as string
    };
  });

  const assignmentExercisesNames = assignmentExercises.map(
    (assignmentExercise) => assignmentExercise.name
  );

  const removeExercises = (toRemove: Array<{ id: number }>) => {
    const idsToRemove = toRemove.map((item) => item.id);

    removeExercisesPost(idsToRemove);
    dispatch(
      exercisesActions.setSelectedExercises(
        selectedExercises.filter((r) => !idsToRemove.includes(r.id))
      )
    );
  };

  const getLeafNodes = (tree: TreeNode[]): TreeNode[] => {
    const leaves: TreeNode[] = [];

    const traverse = (node: TreeNode) => {
      if (!node.children || node.children.length === 0) {
        leaves.push(node);
        return;
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    for (const node of tree) {
      traverse(node);
    }

    return leaves;
  };

  const removeExercisesFromAvailableExercises = ({ node }: TreeTableEvent) => {
    const leafs = getLeafNodes([node]).map((x) => x.data.id as unknown as number);

    removeExercises(assignmentExercises.filter((ex) => leafs.includes(ex.question_id)));
  };

  const filterAvailableExercises = (nodes: TreeNode[], currentLevel: number = 0): TreeNode[] => {
    return nodes
      .filter((node) => node.data.question_type !== "page")
      .map((node) => ({
        ...node,
        level: currentLevel,
        disabled: node.children
          ? !node.children.filter((n) => n.data.question_type !== "page").length
          : false,
        children: node.children
          ? filterAvailableExercises(node.children, currentLevel + 1)
          : undefined
      }));
  };

  const addExercises = async ({ node }: Omit<TreeTableEvent, "originalEvent">) => {
    if (!selectedAssignment) {
      return;
    }

    const { data, children } = node;

    if (children) {
      children.forEach((child) => addExercises({ node: child }));
      return;
    }

    await addExerciseToAssignment([data]);
  };

  const getSelectedKeys = (
    tree: TreeNode[]
  ): Record<string, { checked: boolean; partialChecked: boolean }> => {
    const result: Record<string, { checked: boolean; partialChecked: boolean }> = {};

    const traverse = (node: TreeNode): { checked: boolean; partialChecked: boolean } => {
      const key = node.key as string;
      let isLeaf = !node.children || node.children.length === 0;
      let isChecked = assignmentExercisesNames.includes(key);
      let childCheckedCount = 0;

      if (isLeaf) {
        result[key] = { checked: isChecked, partialChecked: false };
        return result[key];
      }

      let anyChildChecked = false;
      let allChildrenChecked = true;

      for (const child of node.children || []) {
        const childStatus = traverse(child);

        if (childStatus.checked || childStatus.partialChecked) {
          anyChildChecked = true;
        }
        if (!childStatus.checked) {
          allChildrenChecked = false;
        }
        if (childStatus.checked) {
          childCheckedCount++;
        }
      }

      const nodeChecked = allChildrenChecked;
      const nodePartialChecked = anyChildChecked && !allChildrenChecked;

      result[key] = {
        checked: nodeChecked,
        partialChecked: nodePartialChecked
      };

      return result[key];
    };

    for (const node of tree) {
      traverse(node);
    }

    return result;
  };

  const filteredAvailableExercises = filterAvailableExercises(availableExercises);

  return {
    assignmentExercises,
    availableExercises: filteredAvailableExercises,
    selectedKeys: getSelectedKeys(filteredAvailableExercises),
    removeExercises,
    chapters,
    removeExercisesFromAvailableExercises,
    addExercises
  };
};
