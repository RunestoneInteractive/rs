import { configureStore } from "@reduxjs/toolkit";

import {
  chooseExercisesActions,
  chooseExercisesSelectors,
  chooseExercisesSlice,
  ChooseExercisesState
} from "./chooseExercises.logic";
import { Exercise } from "@/types/exercises";

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 1,
  assignment_id: 10,
  question_id: 100,
  points: 1,
  timed: false,
  autograde: "pct_correct",
  which_to_grade: "best_answer",
  reading_assignment: false,
  sorting_priority: 0,
  activities_required: 1,
  use_llm: false,
  qnumber: "Q1",
  name: "ex1",
  subchapter: "sub1",
  chapter: "ch1",
  base_course: "course1",
  htmlsrc: "",
  question_type: "mchoice",
  question_json: "{}",
  owner: "user",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Exercise 1",
  topic: "topic1",
  difficulty: 1,
  author: "author1",
  description: "",
  is_private: false,
  from_source: false,
  ...overrides
});

const buildStore = (preloaded?: Partial<ChooseExercisesState>) =>
  configureStore({
    reducer: { chooseExercises: chooseExercisesSlice.reducer },
    preloadedState: preloaded ? { chooseExercises: { ...initialState(), ...preloaded } } : undefined
  });

const initialState = (): ChooseExercisesState => ({
  selectedKeys: {},
  selectedExercises: [],
  exercisesToAdd: [],
  exercisesToRemove: []
});

describe("chooseExercisesSlice reducer", () => {
  describe("initial state", () => {
    it("returns the correct initial state when called with undefined", () => {
      const store = buildStore();
      const state = store.getState().chooseExercises;

      expect(state.selectedKeys).toEqual({});
      expect(state.selectedExercises).toEqual([]);
      expect(state.exercisesToAdd).toEqual([]);
      expect(state.exercisesToRemove).toEqual([]);
    });
  });

  describe("setSelectedExercises", () => {
    it("stores non-reading exercises sorted by sorting_priority", () => {
      const store = buildStore();
      const ex1 = makeExercise({ name: "ex1", sorting_priority: 2 });
      const ex2 = makeExercise({ name: "ex2", sorting_priority: 1 });

      store.dispatch(chooseExercisesActions.setSelectedExercises([ex1, ex2]));

      const { selectedExercises } = store.getState().chooseExercises;
      expect(selectedExercises).toHaveLength(2);
      expect(selectedExercises[0].name).toBe("ex2");
      expect(selectedExercises[1].name).toBe("ex1");
    });

    it("filters out reading_assignment exercises", () => {
      const store = buildStore();
      const regular = makeExercise({ name: "regular", reading_assignment: false });
      const reading = makeExercise({ name: "reading", reading_assignment: true });

      store.dispatch(chooseExercisesActions.setSelectedExercises([regular, reading]));

      const { selectedExercises } = store.getState().chooseExercises;
      expect(selectedExercises).toHaveLength(1);
      expect(selectedExercises[0].name).toBe("regular");
    });

    it("filters out exercises with question_type 'page'", () => {
      const store = buildStore();
      const regular = makeExercise({ name: "regular", question_type: "mchoice" });
      const page = makeExercise({ name: "page-ex", question_type: "page" });

      store.dispatch(chooseExercisesActions.setSelectedExercises([regular, page]));

      const { selectedExercises } = store.getState().chooseExercises;
      expect(selectedExercises).toHaveLength(1);
      expect(selectedExercises[0].name).toBe("regular");
    });

    it("sets selectedExercises to empty array when all are readings", () => {
      const store = buildStore();
      const reading = makeExercise({ reading_assignment: true });

      store.dispatch(chooseExercisesActions.setSelectedExercises([reading]));

      expect(store.getState().chooseExercises.selectedExercises).toEqual([]);
    });

    it("sets selectedExercises to empty array when given an empty array", () => {
      const store = buildStore();
      store.dispatch(chooseExercisesActions.setSelectedExercises([]));

      expect(store.getState().chooseExercises.selectedExercises).toEqual([]);
    });
  });

  describe("setExercisesToAdd", () => {
    it("stores the provided exercises directly", () => {
      const store = buildStore();
      const ex = makeExercise({ name: "to-add" });

      store.dispatch(chooseExercisesActions.setExercisesToAdd([ex]));

      expect(store.getState().chooseExercises.exercisesToAdd).toEqual([ex]);
    });

    it("replaces any previously stored exercisesToAdd", () => {
      const store = buildStore();
      const first = makeExercise({ name: "first" });
      const second = makeExercise({ name: "second" });

      store.dispatch(chooseExercisesActions.setExercisesToAdd([first]));
      store.dispatch(chooseExercisesActions.setExercisesToAdd([second]));

      expect(store.getState().chooseExercises.exercisesToAdd).toEqual([second]);
    });
  });

  describe("setExercisesToRemove", () => {
    it("stores the provided exercises directly", () => {
      const store = buildStore();
      const ex = makeExercise({ name: "to-remove" });

      store.dispatch(chooseExercisesActions.setExercisesToRemove([ex]));

      expect(store.getState().chooseExercises.exercisesToRemove).toEqual([ex]);
    });

    it("replaces any previously stored exercisesToRemove", () => {
      const store = buildStore();
      const first = makeExercise({ name: "first" });
      const second = makeExercise({ name: "second" });

      store.dispatch(chooseExercisesActions.setExercisesToRemove([first]));
      store.dispatch(chooseExercisesActions.setExercisesToRemove([second]));

      expect(store.getState().chooseExercises.exercisesToRemove).toEqual([second]);
    });
  });

  describe("setSelectedKeys", () => {
    it("stores the provided keys map", () => {
      const store = buildStore();
      const keys = { "ch1.sub1": { checked: true, partialChecked: false } };

      store.dispatch(chooseExercisesActions.setSelectedKeys(keys));

      expect(store.getState().chooseExercises.selectedKeys).toEqual(keys);
    });

    it("replaces previously stored keys", () => {
      const store = buildStore();
      const first = { keyA: { checked: true, partialChecked: false } };
      const second = { keyB: { checked: false, partialChecked: true } };

      store.dispatch(chooseExercisesActions.setSelectedKeys(first));
      store.dispatch(chooseExercisesActions.setSelectedKeys(second));

      expect(store.getState().chooseExercises.selectedKeys).toEqual(second);
    });
  });

  describe("resetSelections", () => {
    it("clears exercisesToAdd and exercisesToRemove while preserving other fields", () => {
      const ex = makeExercise();
      const store = buildStore();

      store.dispatch(chooseExercisesActions.setExercisesToAdd([ex]));
      store.dispatch(chooseExercisesActions.setExercisesToRemove([ex]));
      store.dispatch(chooseExercisesActions.setSelectedExercises([ex]));
      store.dispatch(
        chooseExercisesActions.setSelectedKeys({ key1: { checked: true, partialChecked: false } })
      );

      store.dispatch(chooseExercisesActions.resetSelections());

      const state = store.getState().chooseExercises;
      expect(state.exercisesToAdd).toEqual([]);
      expect(state.exercisesToRemove).toEqual([]);
      expect(state.selectedExercises).toHaveLength(1);
      expect(state.selectedKeys).toEqual({ key1: { checked: true, partialChecked: false } });
    });
  });
});

describe("chooseExercisesSelectors", () => {
  const makeRootState = (partial: Partial<ChooseExercisesState> = {}) => ({
    chooseExercises: { ...initialState(), ...partial }
  });

  it("getSelectedExercises returns selectedExercises from state", () => {
    const ex = makeExercise();
    const state = makeRootState({ selectedExercises: [ex] });

    expect(chooseExercisesSelectors.getSelectedExercises(state as any)).toEqual([ex]);
  });

  it("getExercisesToAdd returns exercisesToAdd from state", () => {
    const ex = makeExercise({ name: "add-me" });
    const state = makeRootState({ exercisesToAdd: [ex] });

    expect(chooseExercisesSelectors.getExercisesToAdd(state as any)).toEqual([ex]);
  });

  it("getExercisesToRemove returns exercisesToRemove from state", () => {
    const ex = makeExercise({ name: "remove-me" });
    const state = makeRootState({ exercisesToRemove: [ex] });

    expect(chooseExercisesSelectors.getExercisesToRemove(state as any)).toEqual([ex]);
  });

  it("getSelectedKeys returns selectedKeys from state", () => {
    const keys = { "ch1.sub1": { checked: true, partialChecked: false } };
    const state = makeRootState({ selectedKeys: keys });

    expect(chooseExercisesSelectors.getSelectedKeys(state as any)).toEqual(keys);
  });

  it("all selectors return empty defaults when state is at initial values", () => {
    const state = makeRootState();

    expect(chooseExercisesSelectors.getSelectedExercises(state as any)).toEqual([]);
    expect(chooseExercisesSelectors.getExercisesToAdd(state as any)).toEqual([]);
    expect(chooseExercisesSelectors.getExercisesToRemove(state as any)).toEqual([]);
    expect(chooseExercisesSelectors.getSelectedKeys(state as any)).toEqual({});
  });
});
