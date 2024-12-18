import sortBy from "lodash/sortBy";
import { TreeNode } from "primereact/treenode";

import { Exercise } from "@/types/exercises";
import { SelectedKey } from "@/types/treeNode";

export const createExerciseId = (): string => {
  const today = new Date();
  const date =
    today.getFullYear() +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    today.getDate().toString().padStart(2, "0");
  const randInt = Math.floor(Math.random() * 10000);

  return `exercise_${date}_${randInt}`;
};

export const getLeafNodes = (tree: TreeNode[]): TreeNode[] => {
  const leaves: TreeNode[] = [];

  const traverse = (node: TreeNode) => {
    if (!node.children) {
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

export const getSelectedKeys = (
  tree: TreeNode[],
  exercises: Exercise[],
  checkedByDefault: boolean = false
): Record<string, SelectedKey> => {
  const result: Record<string, SelectedKey> = {};
  const exercisesNames = exercises.map((ex) => ex.name);

  const traverse = (node: TreeNode): SelectedKey => {
    const key = node.key as string;
    let isLeaf = !node.children || node.children.length === 0;
    let isChecked = checkedByDefault || exercisesNames.includes(key);
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

export const filterAvailableExercises = (
  nodes: TreeNode[],
  currentLevel: number = 0
): TreeNode[] => {
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

export const removeChildrenWithoutTitleImmutable = (nodes: TreeNode[]): TreeNode[] => {
  return nodes
    .map((node) => {
      const { children, ...rest } = node;

      const filteredChildren = children
        ? removeChildrenWithoutTitleImmutable(children).filter((child) => child.data?.title)
        : [];

      return filteredChildren.length > 0 ? { ...rest, children: filteredChildren } : { ...rest };
    })
    .filter((node) => node.data?.title);
};

export const getExercisesWithoutReadings = (exercises: Exercise[]) => {
  return sortBy(
    exercises.filter((ex) => !ex.reading_assignment && ex.question_type !== "page"),
    (exercise) => exercise.sorting_priority
  );
};
