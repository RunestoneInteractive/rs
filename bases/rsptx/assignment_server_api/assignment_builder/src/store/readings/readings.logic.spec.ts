import { configureStore } from "@reduxjs/toolkit";
import { assignmentActions } from "@store/assignment/assignment.logic";

import { Exercise } from "@/types/exercises";
import { TreeNode } from "@/types/treeNode";

import { readingsSlice, readingsActions, readingsSelectors, ReadingsState } from "./readings.logic";

const buildStore = (preloaded?: Partial<{ readings: ReadingsState }>) =>
  configureStore({
    reducer: { readings: readingsSlice.reducer },
    preloadedState: preloaded
  });

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 1,
  assignment_id: 10,
  question_id: 100,
  points: 1,
  timed: false,
  autograde: "pct_correct",
  which_to_grade: "best_answer",
  reading_assignment: true,
  sorting_priority: 0,
  activities_required: 1,
  use_llm: false,
  qnumber: "q1",
  name: "exercise_one",
  subchapter: "sub1",
  chapter: "ch1",
  base_course: "course",
  htmlsrc: "<p>src</p>",
  question_type: "mchoice",
  question_json: "{}",
  owner: "owner",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Exercise One",
  topic: "topic",
  difficulty: 1,
  author: "author",
  description: "desc",
  is_private: false,
  from_source: true,
  ...overrides
});

const makeNode = (key: string, title: string | null, children?: TreeNode[]): TreeNode => ({
  key,
  label: title ?? undefined,
  data: title ? { title } : {},
  ...(children !== undefined ? { children } : {})
});

describe("readingsSlice – initial state", () => {
  it("returns empty selectedReadings and availableReadings by default", () => {
    const store = buildStore();
    const state = store.getState().readings;

    expect(state.selectedReadings).toEqual([]);
    expect(state.availableReadings).toEqual([]);
  });
});

describe("readingsActions.setSelectedReadings", () => {
  it("replaces selectedReadings with the dispatched array", () => {
    const store = buildStore();
    const exercises = [makeExercise({ id: 1 }), makeExercise({ id: 2, name: "exercise_two" })];

    store.dispatch(readingsActions.setSelectedReadings(exercises));

    expect(store.getState().readings.selectedReadings).toEqual(exercises);
  });

  it("clears selectedReadings when an empty array is dispatched", () => {
    const store = buildStore({
      readings: {
        selectedReadings: [makeExercise()],
        availableReadings: [],
        selectionAssignmentId: null
      }
    });

    store.dispatch(readingsActions.setSelectedReadings([]));

    expect(store.getState().readings.selectedReadings).toEqual([]);
  });
});

describe("readingsActions.setAvailableReadings", () => {
  it("stores nodes that have a title", () => {
    const store = buildStore();
    const nodes: TreeNode[] = [makeNode("n1", "Chapter 1"), makeNode("n2", "Chapter 2")];

    store.dispatch(readingsActions.setAvailableReadings(nodes));

    const stored = store.getState().readings.availableReadings;
    expect(stored).toHaveLength(2);
    expect(stored[0].key).toBe("n1");
    expect(stored[1].key).toBe("n2");
  });

  it("filters out top-level nodes without a title", () => {
    const store = buildStore();
    const nodes: TreeNode[] = [makeNode("n1", "Has Title"), makeNode("n2", null)];

    store.dispatch(readingsActions.setAvailableReadings(nodes));

    const stored = store.getState().readings.availableReadings;
    expect(stored).toHaveLength(1);
    expect(stored[0].key).toBe("n1");
  });

  it("filters out children without a title but keeps parent when other children exist", () => {
    const store = buildStore();
    const child1 = makeNode("c1", "Child With Title");
    const child2 = makeNode("c2", null);
    const parent = makeNode("p1", "Parent", [child1, child2]);

    store.dispatch(readingsActions.setAvailableReadings([parent]));

    const stored = store.getState().readings.availableReadings;
    expect(stored).toHaveLength(1);
    expect(stored[0].children).toHaveLength(1);
    expect(stored[0].children![0].key).toBe("c1");
  });

  it("keeps parent node but strips all children when every child lacks a title", () => {
    const store = buildStore();
    const child1 = makeNode("c1", null);
    const child2 = makeNode("c2", null);
    const parent = makeNode("p1", "Parent", [child1, child2]);

    store.dispatch(readingsActions.setAvailableReadings([parent]));

    const stored = store.getState().readings.availableReadings;
    expect(stored).toHaveLength(1);
    expect(stored[0].key).toBe("p1");
    expect(stored[0].children).toBeUndefined();
  });

  it("replaces previously stored availableReadings", () => {
    const initialNodes: TreeNode[] = [makeNode("old", "Old Node")];
    const store = buildStore({
      readings: {
        selectedReadings: [],
        availableReadings: initialNodes,
        selectionAssignmentId: null
      }
    });

    const newNodes: TreeNode[] = [makeNode("new", "New Node")];
    store.dispatch(readingsActions.setAvailableReadings(newNodes));

    const stored = store.getState().readings.availableReadings;
    expect(stored).toHaveLength(1);
    expect(stored[0].key).toBe("new");
  });

  it("handles an empty array without errors", () => {
    const store = buildStore();

    store.dispatch(readingsActions.setAvailableReadings([]));

    expect(store.getState().readings.availableReadings).toEqual([]);
  });
});

describe("readingsSelectors", () => {
  it("getSelectedReadings returns the selectedReadings slice", () => {
    const exercises = [makeExercise()];
    const store = buildStore({
      readings: { selectedReadings: exercises, availableReadings: [], selectionAssignmentId: null }
    });

    const result = readingsSelectors.getSelectedReadings(store.getState() as any);

    expect(result).toEqual(exercises);
  });

  it("getAvailableReadings returns the availableReadings slice", () => {
    const nodes: TreeNode[] = [makeNode("n1", "Chapter 1")];
    const store = buildStore({
      readings: { selectedReadings: [], availableReadings: nodes, selectionAssignmentId: null }
    });

    const result = readingsSelectors.getAvailableReadings(store.getState() as any);

    expect(result).toEqual(nodes);
  });

  it("getSelectedReadings returns empty array when no readings are selected", () => {
    const store = buildStore();

    const result = readingsSelectors.getSelectedReadings(store.getState() as any);

    expect(result).toEqual([]);
  });
});

describe("assignment switching", () => {
  it("clears selectedReadings when the selected assignment id changes", () => {
    const store = buildStore();

    store.dispatch(assignmentActions.setSelectedAssignmentId(1));
    store.dispatch(readingsActions.setSelectedReadings([makeExercise()]));
    store.dispatch(assignmentActions.setSelectedAssignmentId(2));

    expect(store.getState().readings.selectedReadings).toEqual([]);
  });

  it("keeps selectedReadings when the same assignment id is dispatched again", () => {
    const store = buildStore();
    const reading = makeExercise();

    store.dispatch(assignmentActions.setSelectedAssignmentId(1));
    store.dispatch(readingsActions.setSelectedReadings([reading]));
    store.dispatch(assignmentActions.setSelectedAssignmentId(1));

    expect(store.getState().readings.selectedReadings).toEqual([reading]);
  });
});
