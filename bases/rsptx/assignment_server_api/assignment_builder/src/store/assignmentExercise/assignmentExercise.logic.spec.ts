import { configureStore } from "@reduxjs/toolkit";

import {
  assignmentExerciseActions,
  assignmentExerciseSelectors,
  assignmentExerciseSlice,
  AssignmentExerciseState
} from "./assignmentExercise.logic";
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
  activities_required: 0,
  use_llm: false,
  qnumber: "q1",
  name: "exercise_1",
  subchapter: "sub1",
  chapter: "ch1",
  base_course: "base",
  htmlsrc: "",
  question_type: "mchoice",
  question_json: "",
  owner: "owner",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Exercise 1",
  topic: "topic1",
  difficulty: 1,
  author: "author",
  description: "",
  is_private: false,
  from_source: true,
  ...overrides
});

const buildStore = (preloadedExercises: Exercise[] = []) =>
  configureStore({
    reducer: {
      assignmentExercise: assignmentExerciseSlice.reducer
    },
    preloadedState: {
      assignmentExercise: { assignmentExercises: preloadedExercises } as AssignmentExerciseState
    }
  });

describe("assignmentExerciseSlice reducer", () => {
  it("returns initial state with empty assignmentExercises when no action dispatched", () => {
    const store = buildStore();
    expect(store.getState().assignmentExercise.assignmentExercises).toEqual([]);
  });

  it("sets assignment exercises when setAssignmentExercises is dispatched with a list", () => {
    const store = buildStore();
    const exercises = [makeExercise({ id: 1 }), makeExercise({ id: 2, name: "exercise_2" })];

    store.dispatch(assignmentExerciseActions.setAssignmentExercises(exercises));

    expect(store.getState().assignmentExercise.assignmentExercises).toEqual(exercises);
  });

  it("replaces existing exercises when setAssignmentExercises is dispatched again", () => {
    const initial = [makeExercise({ id: 1 })];
    const store = buildStore(initial);
    const replacement = [makeExercise({ id: 99, name: "exercise_99" })];

    store.dispatch(assignmentExerciseActions.setAssignmentExercises(replacement));

    expect(store.getState().assignmentExercise.assignmentExercises).toEqual(replacement);
  });

  it("clears all exercises when setAssignmentExercises is dispatched with empty array", () => {
    const store = buildStore([makeExercise()]);

    store.dispatch(assignmentExerciseActions.setAssignmentExercises([]));

    expect(store.getState().assignmentExercise.assignmentExercises).toEqual([]);
  });
});

describe("getAssignmentExercises selector", () => {
  it("returns empty array when no exercises are in state", () => {
    const store = buildStore();
    const result = assignmentExerciseSelectors.getAssignmentExercises(store.getState() as any);
    expect(result).toEqual([]);
  });

  it("excludes reading_assignment exercises from the result", () => {
    const reading = makeExercise({ id: 2, reading_assignment: true, name: "reading_1" });
    const nonReading = makeExercise({ id: 3, reading_assignment: false, name: "exercise_3" });
    const store = buildStore([reading, nonReading]);

    const result = assignmentExerciseSelectors.getAssignmentExercises(store.getState() as any);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  it("excludes exercises whose question_type is 'page'", () => {
    const page = makeExercise({ id: 4, question_type: "page", name: "page_1" });
    const normal = makeExercise({ id: 5, question_type: "mchoice", name: "exercise_5" });
    const store = buildStore([page, normal]);

    const result = assignmentExerciseSelectors.getAssignmentExercises(store.getState() as any);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(5);
  });

  it("returns exercises sorted by sorting_priority ascending", () => {
    const ex1 = makeExercise({ id: 1, sorting_priority: 3, name: "ex1" });
    const ex2 = makeExercise({ id: 2, sorting_priority: 1, name: "ex2" });
    const ex3 = makeExercise({ id: 3, sorting_priority: 2, name: "ex3" });
    const store = buildStore([ex1, ex2, ex3]);

    const result = assignmentExerciseSelectors.getAssignmentExercises(store.getState() as any);

    expect(result.map((e) => e.id)).toEqual([2, 3, 1]);
  });
});

describe("getAssignmentReadings selector", () => {
  it("returns empty array when no exercises are in state", () => {
    const store = buildStore();
    const result = assignmentExerciseSelectors.getAssignmentReadings(store.getState() as any);
    expect(result).toEqual([]);
  });

  it("returns only exercises with reading_assignment true", () => {
    const reading = makeExercise({ id: 10, reading_assignment: true, name: "reading_1" });
    const nonReading = makeExercise({ id: 11, reading_assignment: false, name: "exercise_11" });
    const store = buildStore([reading, nonReading]);

    const result = assignmentExerciseSelectors.getAssignmentReadings(store.getState() as any);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
  });

  it("returns reading exercises sorted by sorting_priority ascending", () => {
    const r1 = makeExercise({ id: 20, reading_assignment: true, sorting_priority: 5, name: "r1" });
    const r2 = makeExercise({ id: 21, reading_assignment: true, sorting_priority: 2, name: "r2" });
    const r3 = makeExercise({ id: 22, reading_assignment: true, sorting_priority: 8, name: "r3" });
    const store = buildStore([r1, r2, r3]);

    const result = assignmentExerciseSelectors.getAssignmentReadings(store.getState() as any);

    expect(result.map((e) => e.id)).toEqual([21, 20, 22]);
  });

  it("does not exclude page-type exercises from readings (only reading_assignment matters)", () => {
    const pagReading = makeExercise({
      id: 30,
      reading_assignment: true,
      question_type: "page",
      name: "page_reading"
    });
    const store = buildStore([pagReading]);

    const result = assignmentExerciseSelectors.getAssignmentReadings(store.getState() as any);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(30);
  });
});

describe("setAssignmentExercisesForAssignment", () => {
  it("stores the exercises together with the assignment id they belong to", () => {
    const store = buildStore();
    const exercises = [makeExercise({ id: 1 })];

    store.dispatch(
      assignmentExerciseActions.setAssignmentExercisesForAssignment({
        assignmentId: 6,
        exercises
      })
    );

    expect(store.getState().assignmentExercise.assignmentExercises).toEqual(exercises);
    expect(
      assignmentExerciseSelectors.getExercisesForAssignmentId(store.getState() as any)
    ).toBe(6);
  });

  it("reports the data as belonging to the new assignment after a switch", () => {
    const store = buildStore();

    store.dispatch(
      assignmentExerciseActions.setAssignmentExercisesForAssignment({
        assignmentId: 6,
        exercises: [makeExercise({ id: 1 })]
      })
    );
    store.dispatch(
      assignmentExerciseActions.setAssignmentExercisesForAssignment({
        assignmentId: 7,
        exercises: []
      })
    );

    expect(store.getState().assignmentExercise.assignmentExercises).toEqual([]);
    expect(
      assignmentExerciseSelectors.getExercisesForAssignmentId(store.getState() as any)
    ).toBe(7);
  });
});
