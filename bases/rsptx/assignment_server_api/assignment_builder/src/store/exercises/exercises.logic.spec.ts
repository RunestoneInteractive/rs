import { configureStore } from "@reduxjs/toolkit";
import { assignmentActions } from "@store/assignment/assignment.logic";

import { Exercise } from "@/types/exercises";
import { TreeNode } from "@/types/treeNode";
import {
  exercisesActions,
  exercisesSelectors,
  exercisesSlice,
  ExercisesState
} from "./exercises.logic";

const makeStore = (preloadedState?: { exercises: ExercisesState }) =>
  configureStore({
    reducer: { exercises: exercisesSlice.reducer },
    preloadedState
  });

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 1,
  assignment_id: 10,
  question_id: 100,
  points: 5,
  timed: false,
  autograde: "all_or_nothing",
  which_to_grade: "best_answer",
  reading_assignment: false,
  sorting_priority: 0,
  activities_required: 0,
  use_llm: false,
  qnumber: "q1",
  name: "exercise-one",
  subchapter: "sub1",
  chapter: "ch1",
  base_course: "course101",
  htmlsrc: "<p>hello</p>",
  question_type: "mchoice",
  question_json: "{}",
  owner: "author1",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Exercise One",
  topic: "topic1",
  difficulty: 1,
  author: "author1",
  description: "",
  is_private: false,
  from_source: true,
  ...overrides
});

const makeTreeNode = (
  overrides: Partial<TreeNode> & { data?: Record<string, unknown> } = {}
): TreeNode => ({
  key: "node-1",
  label: "Node 1",
  data: { question_type: "mchoice" },
  ...overrides
});

describe("exercisesSlice reducer", () => {
  it("returns the initial state when called with undefined state", () => {
    const store = makeStore();
    const state = store.getState().exercises;

    expect(state.selectedExercises).toEqual([]);
    expect(state.availableExercises).toEqual([]);
  });

  describe("setSelectedExercises", () => {
    it("replaces selectedExercises with the provided array", () => {
      const store = makeStore();
      const exercises = [makeExercise({ id: 1 }), makeExercise({ id: 2, name: "exercise-two" })];

      store.dispatch(exercisesActions.setSelectedExercises(exercises));

      expect(store.getState().exercises.selectedExercises).toEqual(exercises);
    });

    it("sets selectedExercises to an empty array when dispatched with []", () => {
      const store = makeStore({
        exercises: {
          selectedExercises: [makeExercise()],
          availableExercises: [],
          selectionAssignmentId: null
        }
      });

      store.dispatch(exercisesActions.setSelectedExercises([]));

      expect(store.getState().exercises.selectedExercises).toEqual([]);
    });

    it("does not affect availableExercises", () => {
      const node = makeTreeNode();
      const store = makeStore({
        exercises: {
          selectedExercises: [],
          availableExercises: [node],
          selectionAssignmentId: null
        }
      });

      store.dispatch(exercisesActions.setSelectedExercises([makeExercise()]));

      expect(store.getState().exercises.availableExercises).toEqual([node]);
    });
  });

  describe("setAvailableExercises", () => {
    it("stores non-page nodes after applying filterAvailableExercises", () => {
      const store = makeStore();
      const node = makeTreeNode({ key: "ch1", data: { question_type: "mchoice" } });

      store.dispatch(exercisesActions.setAvailableExercises([node]));

      const result = store.getState().exercises.availableExercises;
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("ch1");
    });

    it("filters out nodes whose question_type is 'page'", () => {
      const store = makeStore();
      const pageNode = makeTreeNode({ key: "page-1", data: { question_type: "page" } });
      const regularNode = makeTreeNode({ key: "q-1", data: { question_type: "shortanswer" } });

      store.dispatch(exercisesActions.setAvailableExercises([pageNode, regularNode]));

      const result = store.getState().exercises.availableExercises;
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("q-1");
    });

    it("attaches a level property to each node", () => {
      const store = makeStore();
      const node = makeTreeNode({ key: "n1", data: { question_type: "mchoice" } });

      store.dispatch(exercisesActions.setAvailableExercises([node]));

      expect((store.getState().exercises.availableExercises[0] as any).level).toBe(0);
    });

    it("marks a parent node as disabled when all children are page nodes", () => {
      const store = makeStore();
      const childPage = makeTreeNode({ key: "child-page", data: { question_type: "page" } });
      const parent: TreeNode = {
        key: "parent",
        label: "Parent",
        data: { question_type: "chapter" },
        children: [childPage]
      };

      store.dispatch(exercisesActions.setAvailableExercises([parent]));

      const result = store.getState().exercises.availableExercises;
      expect(result[0].disabled).toBe(true);
    });

    it("does not mark a parent node as disabled when it has non-page children", () => {
      const store = makeStore();
      const childMchoice = makeTreeNode({ key: "child-q", data: { question_type: "mchoice" } });
      const parent: TreeNode = {
        key: "parent",
        label: "Parent",
        data: { question_type: "chapter" },
        children: [childMchoice]
      };

      store.dispatch(exercisesActions.setAvailableExercises([parent]));

      const result = store.getState().exercises.availableExercises;
      expect(result[0].disabled).toBe(false);
    });

    it("does not affect selectedExercises", () => {
      const exercise = makeExercise();
      const store = makeStore({
        exercises: {
          selectedExercises: [exercise],
          availableExercises: [],
          selectionAssignmentId: null
        }
      });

      store.dispatch(
        exercisesActions.setAvailableExercises([
          makeTreeNode({ key: "n1", data: { question_type: "mchoice" } })
        ])
      );

      expect(store.getState().exercises.selectedExercises).toEqual([exercise]);
    });
  });
});

describe("exercisesSelectors", () => {
  it("getSelectedExercises returns the current selectedExercises array", () => {
    const exercises = [makeExercise()];
    const store = makeStore({
      exercises: { selectedExercises: exercises, availableExercises: [], selectionAssignmentId: null }
    });
    const state = store.getState() as any;

    expect(exercisesSelectors.getSelectedExercises(state)).toEqual(exercises);
  });

  it("getSelectedExercises returns an empty array when no exercises are selected", () => {
    const store = makeStore();
    const state = store.getState() as any;

    expect(exercisesSelectors.getSelectedExercises(state)).toEqual([]);
  });

  it("getAvailableExercises returns the current availableExercises array", () => {
    const node = makeTreeNode();
    const store = makeStore({
      exercises: { selectedExercises: [], availableExercises: [node], selectionAssignmentId: null }
    });
    const state = store.getState() as any;

    expect(exercisesSelectors.getAvailableExercises(state)).toEqual([node]);
  });

  it("getAvailableExercises returns an empty array when no exercises are available", () => {
    const store = makeStore();
    const state = store.getState() as any;

    expect(exercisesSelectors.getAvailableExercises(state)).toEqual([]);
  });
});

describe("assignment switching", () => {
  it("clears selectedExercises when the selected assignment id changes", () => {
    const store = makeStore();

    store.dispatch(assignmentActions.setSelectedAssignmentId(1));
    store.dispatch(exercisesActions.setSelectedExercises([makeExercise()]));
    store.dispatch(assignmentActions.setSelectedAssignmentId(2));

    expect(store.getState().exercises.selectedExercises).toEqual([]);
  });

  it("keeps selectedExercises when the same assignment id is dispatched again", () => {
    const store = makeStore();
    const exercise = makeExercise();

    store.dispatch(assignmentActions.setSelectedAssignmentId(1));
    store.dispatch(exercisesActions.setSelectedExercises([exercise]));
    store.dispatch(assignmentActions.setSelectedAssignmentId(1));

    expect(store.getState().exercises.selectedExercises).toEqual([exercise]);
  });
});
