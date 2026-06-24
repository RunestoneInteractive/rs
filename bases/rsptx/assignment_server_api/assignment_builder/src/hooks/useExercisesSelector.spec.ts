import { renderHook, act } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import React from "react";
import { assignmentSlice } from "@store/assignment/assignment.logic";
import { assignmentExerciseSlice } from "@store/assignmentExercise/assignmentExercise.logic";
import { exercisesSlice } from "@store/exercises/exercises.logic";
import { readingsSlice } from "@store/readings/readings.logic";
import { useExercisesSelector } from "./useExercisesSelector";
import type { Exercise } from "@/types/exercises";

vi.mock("@store/assignmentExercise/assignmentExercise.logic.api", () => ({
  useGetExercisesQuery: vi.fn(),
  useRemoveAssignmentExercisesMutation: vi.fn()
}));

vi.mock("@components/ui/notify", () => ({
  notify: {
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    update: vi.fn(),
    hide: vi.fn(),
    clean: vi.fn()
  }
}));

import {
  useGetExercisesQuery,
  useRemoveAssignmentExercisesMutation
} from "@store/assignmentExercise/assignmentExercise.logic.api";
import { notify } from "@components/ui/notify";

const mockRefetchExercises = vi.fn();
const mockRemoveExercisesPost = vi.fn();

function buildStore(preloaded?: {
  assignmentTemp?: { selectedAssignmentId: number | null };
  assignmentExercise?: { assignmentExercises: Exercise[] };
  exercises?: { selectedExercises: Exercise[]; availableExercises: any[] };
  readings?: { selectedReadings: Exercise[]; availableReadings: any[] };
}) {
  return configureStore({
    reducer: {
      assignmentTemp: assignmentSlice.reducer,
      assignmentExercise: assignmentExerciseSlice.reducer,
      exercises: exercisesSlice.reducer,
      readings: readingsSlice.reducer
    },
    preloadedState: preloaded as any
  });
}

function makeWrapper(store: ReturnType<typeof buildStore>) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store }, children);
}

const baseExercise: Exercise = {
  id: 1,
  assignment_id: 10,
  question_id: 100,
  points: 5,
  timed: false,
  autograde: "pct_correct",
  which_to_grade: "best_answer",
  reading_assignment: false,
  sorting_priority: 0,
  activities_required: 0,
  use_llm: false,
  qnumber: "1",
  name: "q1",
  subchapter: "sub1",
  chapter: "ch1",
  base_course: "course",
  htmlsrc: "<p>q1</p>",
  question_type: "mchoice",
  question_json: "{}",
  owner: "instructor",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Question 1",
  topic: "topic1",
  difficulty: 1,
  author: "author",
  description: "",
  is_private: false,
  from_source: false
};

const readingExercise: Exercise = {
  ...baseExercise,
  id: 2,
  reading_assignment: true,
  name: "reading1",
  question_type: "page",
  sorting_priority: 1
};

beforeEach(() => {
  vi.clearAllMocks();
  (useGetExercisesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
    isLoading: false,
    isError: false,
    refetch: mockRefetchExercises
  });
  (useRemoveAssignmentExercisesMutation as ReturnType<typeof vi.fn>).mockReturnValue([
    mockRemoveExercisesPost
  ]);
});

describe("useExercisesSelector — loading state", () => {
  it("returns loading:true and removeExercises when exercises are loading", () => {
    (useGetExercisesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: true,
      isError: false,
      refetch: mockRefetchExercises
    });

    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    expect(result.current).toMatchObject({ loading: true });
    expect(typeof result.current.removeExercises).toBe("function");
    expect(result.current).not.toHaveProperty("assignmentExercises");
  });
});

describe("useExercisesSelector — error state", () => {
  it("returns error:true and refetch when exercises fetch errors", () => {
    (useGetExercisesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      isError: true,
      refetch: mockRefetchExercises
    });

    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    expect(result.current).toMatchObject({ error: true });
    expect(typeof result.current.refetch).toBe("function");
  });

  it("returns removeExercises when in error state", () => {
    (useGetExercisesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      isError: true,
      refetch: mockRefetchExercises
    });

    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    expect(typeof result.current.removeExercises).toBe("function");
    expect(result.current).not.toHaveProperty("assignmentExercises");
  });
});

describe("useExercisesSelector — success state", () => {
  it("returns assignmentExercises filtered to non-reading, non-page exercises", () => {
    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [baseExercise, readingExercise] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    expect(result.current).toHaveProperty("assignmentExercises");
    const exercises = (result.current as any).assignmentExercises as Exercise[];
    expect(exercises.every((ex) => !ex.reading_assignment)).toBe(true);
    expect(exercises.every((ex) => ex.question_type !== "page")).toBe(true);
  });

  it("returns chapters mapped from availableReadings nodes", () => {
    const availableReadings = [
      { key: "ch1", data: { title: "Chapter 1" } },
      { key: "ch2", data: { title: "Chapter 2" } }
    ];

    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [baseExercise] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    const chapters = (result.current as any).chapters;
    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toEqual({ value: "ch1", label: "Chapter 1" });
    expect(chapters[1]).toEqual({ value: "ch2", label: "Chapter 2" });
  });

  it("returns empty chapters when availableReadings is empty", () => {
    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [baseExercise] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    expect((result.current as any).chapters).toEqual([]);
  });

  it("exposes isExercisesError as true when no selectedAssignmentId", () => {
    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: null },
      assignmentExercise: { assignmentExercises: [baseExercise] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    const r = result.current as any;
    if ("assignmentExercises" in r) {
      expect(r.isExercisesError).toBe(true);
    } else {
      expect(r.error).toBe(true);
    }
  });

  it("returns refetchExercises function in success state", () => {
    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [baseExercise] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    expect(typeof (result.current as any).refetchExercises).toBe("function");
  });

  it("sorts assignmentExercises by sorting_priority ascending", () => {
    const ex1 = { ...baseExercise, id: 1, sorting_priority: 3 };
    const ex2 = { ...baseExercise, id: 2, sorting_priority: 1 };
    const ex3 = { ...baseExercise, id: 3, sorting_priority: 2 };

    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [ex1, ex2, ex3] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    const exercises = (result.current as any).assignmentExercises as Exercise[];
    expect(exercises.map((e) => e.id)).toEqual([2, 3, 1]);
  });
});

describe("useExercisesSelector — removeExercises", () => {
  it("does nothing when toRemove array is empty", async () => {
    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [baseExercise] },
      exercises: { selectedExercises: [baseExercise], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    await act(async () => {
      await result.current.removeExercises([]);
    });

    expect(mockRemoveExercisesPost).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
  });

  it("calls removeExercisesPost with extracted ids when toRemove is non-empty", async () => {
    mockRemoveExercisesPost.mockResolvedValue({ error: undefined });

    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [baseExercise] },
      exercises: { selectedExercises: [baseExercise], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    await act(async () => {
      await result.current.removeExercises([{ id: 1 }]);
    });

    expect(mockRemoveExercisesPost).toHaveBeenCalledWith([1]);
  });

  it("shows success toast after successful removal", async () => {
    mockRemoveExercisesPost.mockResolvedValue({ error: undefined });

    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [baseExercise] },
      exercises: { selectedExercises: [baseExercise], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    await act(async () => {
      await result.current.removeExercises([{ id: 1 }]);
    });

    expect(notify.success).toHaveBeenCalledWith("Removed 1 exercise");
  });

  it("does not show toast when removal returns an error", async () => {
    mockRemoveExercisesPost.mockResolvedValue({ error: new Error("Network error") });

    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [baseExercise] },
      exercises: { selectedExercises: [baseExercise], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    await act(async () => {
      await result.current.removeExercises([{ id: 1 }]);
    });

    expect(notify.success).not.toHaveBeenCalled();
  });

  it("includes count of removed exercises in success toast message", async () => {
    mockRemoveExercisesPost.mockResolvedValue({ error: undefined });

    const ex2 = { ...baseExercise, id: 2, name: "q2" };
    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [baseExercise, ex2] },
      exercises: { selectedExercises: [baseExercise, ex2], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    await act(async () => {
      await result.current.removeExercises([{ id: 1 }, { id: 2 }]);
    });

    expect(notify.success).toHaveBeenCalledWith("Removed 2 exercises");
  });
});

describe("useExercisesSelector — refetch", () => {
  it("calls refetchExercises when refetch is invoked", () => {
    (useGetExercisesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      isError: true,
      refetch: mockRefetchExercises
    });

    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    const { result } = renderHook(() => useExercisesSelector(), {
      wrapper: makeWrapper(store)
    });

    act(() => {
      (result.current as any).refetch();
    });

    expect(mockRefetchExercises).toHaveBeenCalledTimes(1);
  });
});

describe("useExercisesSelector — useGetExercisesQuery skip behavior", () => {
  it("calls useGetExercisesQuery with skip:true when no selectedAssignmentId", () => {
    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: null },
      assignmentExercise: { assignmentExercises: [baseExercise] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    renderHook(() => useExercisesSelector(), { wrapper: makeWrapper(store) });

    expect(useGetExercisesQuery).toHaveBeenCalledWith(0, expect.objectContaining({ skip: true }));
  });

  it("calls useGetExercisesQuery with skip:false when selectedAssignmentId is set", () => {
    const store = buildStore({
      assignmentTemp: { selectedAssignmentId: 10 },
      assignmentExercise: { assignmentExercises: [baseExercise] },
      exercises: { selectedExercises: [], availableExercises: [] },
      readings: { selectedReadings: [], availableReadings: [] }
    });

    renderHook(() => useExercisesSelector(), { wrapper: makeWrapper(store) });

    expect(useGetExercisesQuery).toHaveBeenCalledWith(10, expect.objectContaining({ skip: false }));
  });
});
