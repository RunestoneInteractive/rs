import { configureStore } from "@reduxjs/toolkit";

import {
  searchExercisesSlice,
  searchExercisesActions,
  searchExercisesSelectors,
  SearchExercisesState
} from "./searchExercises.logic";
import type { Exercise } from "@/types/exercises";

const makeStore = (preloadedState?: { searchExercises: SearchExercisesState }) =>
  configureStore({
    reducer: { searchExercises: searchExercisesSlice.reducer },
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
  activities_required: 1,
  use_llm: false,
  qnumber: "q1",
  name: "exercise-1",
  subchapter: "subchapter-1",
  chapter: "chapter-1",
  base_course: "base",
  htmlsrc: "<p>test</p>",
  question_type: "mchoice",
  question_json: "{}",
  owner: "owner1",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: true,
  title: "Exercise Title",
  topic: "topic-1",
  difficulty: 1,
  author: "author1",
  description: "description",
  is_private: false,
  from_source: true,
  ...overrides
});

describe("searchExercisesSlice reducer", () => {
  it("returns the initial state with empty selectedExercises when no action is dispatched", () => {
    const store = makeStore();
    expect(store.getState().searchExercises.selectedExercises).toEqual([]);
  });

  it("sets selectedExercises to the provided array when setSelectedExercises is dispatched", () => {
    const store = makeStore();
    const exercises = [makeExercise({ id: 1 }), makeExercise({ id: 2 })];

    store.dispatch(searchExercisesActions.setSelectedExercises(exercises));

    expect(store.getState().searchExercises.selectedExercises).toEqual(exercises);
  });

  it("replaces previously selected exercises when setSelectedExercises is dispatched again", () => {
    const first = [makeExercise({ id: 1 })];
    const second = [makeExercise({ id: 2 }), makeExercise({ id: 3 })];
    const store = makeStore();

    store.dispatch(searchExercisesActions.setSelectedExercises(first));
    store.dispatch(searchExercisesActions.setSelectedExercises(second));

    expect(store.getState().searchExercises.selectedExercises).toEqual(second);
  });

  it("clears selectedExercises when setSelectedExercises is dispatched with an empty array", () => {
    const store = makeStore({
      searchExercises: { selectedExercises: [makeExercise()] }
    });

    store.dispatch(searchExercisesActions.setSelectedExercises([]));

    expect(store.getState().searchExercises.selectedExercises).toEqual([]);
  });
});

describe("searchExercisesSelectors.getSelectedExercises", () => {
  it("returns an empty array from the initial state", () => {
    const store = makeStore();
    const result = searchExercisesSelectors.getSelectedExercises(store.getState() as any);
    expect(result).toEqual([]);
  });

  it("returns the exercises that were set via setSelectedExercises", () => {
    const store = makeStore();
    const exercises = [makeExercise({ id: 5 })];

    store.dispatch(searchExercisesActions.setSelectedExercises(exercises));

    const result = searchExercisesSelectors.getSelectedExercises(store.getState() as any);
    expect(result).toEqual(exercises);
  });

  it("returns the same reference as what was dispatched (RTK Immer proxy behaves correctly)", () => {
    const store = makeStore();
    const exercises = [makeExercise({ id: 7 })];

    store.dispatch(searchExercisesActions.setSelectedExercises(exercises));

    const result = searchExercisesSelectors.getSelectedExercises(store.getState() as any);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(7);
  });
});

describe("searchExercisesActions action creators", () => {
  it("setSelectedExercises creates an action with the correct type", () => {
    const exercises = [makeExercise()];
    const action = searchExercisesActions.setSelectedExercises(exercises);

    expect(action.type).toBe("searchExercises/setSelectedExercises");
    expect(action.payload).toEqual(exercises);
  });

  it("setSelectedExercises creates an action with an empty array payload", () => {
    const action = searchExercisesActions.setSelectedExercises([]);

    expect(action.type).toBe("searchExercises/setSelectedExercises");
    expect(action.payload).toEqual([]);
  });
});
