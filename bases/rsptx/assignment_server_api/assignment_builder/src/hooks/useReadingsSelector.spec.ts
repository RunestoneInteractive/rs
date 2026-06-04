import { renderHook } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import React from "react";
import { assignmentSlice } from "@store/assignment/assignment.logic";
import { assignmentExerciseSlice } from "@store/assignmentExercise/assignmentExercise.logic";
import { readingsSlice } from "@store/readings/readings.logic";
import { assignmentExerciseApi } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { useReadingsSelector } from "./useReadingsSelector";
import { TreeNode } from "@/types/treeNode";
import { Exercise } from "@/types/exercises";

vi.mock("@store/assignmentExercise/assignmentExercise.logic.api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@store/assignmentExercise/assignmentExercise.logic.api")>();
  return {
    ...actual,
    useGetExercisesQuery: vi.fn()
  };
});

const { useGetExercisesQuery } = await import(
  "@store/assignmentExercise/assignmentExercise.logic.api"
);

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
  activities_required: 0,
  use_llm: false,
  qnumber: "q1",
  name: "q1",
  subchapter: "sub1",
  chapter: "ch1",
  base_course: "course",
  htmlsrc: "",
  question_type: "page",
  question_json: "",
  owner: "user",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Q1",
  topic: "",
  difficulty: 1,
  author: "author",
  description: "",
  is_private: false,
  from_source: true,
  ...overrides
});

const buildStore = (
  selectedAssignmentId: number | null = null,
  assignmentExercises: Exercise[] = [],
  availableReadings: TreeNode[] = [],
  forAssignmentId: number | null = selectedAssignmentId
) => {
  return configureStore({
    reducer: {
      assignmentTemp: assignmentSlice.reducer,
      assignmentExercise: assignmentExerciseSlice.reducer,
      readings: readingsSlice.reducer,
      [assignmentExerciseApi.reducerPath]: assignmentExerciseApi.reducer
    },
    preloadedState: {
      assignmentTemp: { selectedAssignmentId },
      assignmentExercise: { assignmentExercises, forAssignmentId },
      readings: { availableReadings, selectedReadings: [], selectionAssignmentId: null }
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }).concat(assignmentExerciseApi.middleware)
  });
};

const wrapper =
  (store: ReturnType<typeof buildStore>) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store }, children);

describe("useReadingsSelector", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("returns loading true when exercises query is loading", () => {
      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: true,
        isError: false,
        data: undefined,
        refetch: vi.fn()
      } as any);

      const store = buildStore(10);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      expect(result.current).toEqual({ loading: true });
    });
  });

  describe("error state", () => {
    it("returns error true and refetch when query errors", () => {
      const mockRefetch = vi.fn();
      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isError: true,
        data: undefined,
        refetch: mockRefetch
      } as any);

      const store = buildStore(10);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      expect((result.current as any).error).toBe(true);
      expect(typeof (result.current as any).refetch).toBe("function");
    });

    it("returns error true when data is undefined and not loading", () => {
      const mockRefetch = vi.fn();
      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isError: false,
        data: undefined,
        refetch: mockRefetch
      } as any);

      const store = buildStore(10);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      expect((result.current as any).error).toBe(true);
    });

    it("refetch calls the underlying refetch function", () => {
      const mockRefetch = vi.fn();
      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isError: true,
        data: undefined,
        refetch: mockRefetch
      } as any);

      const store = buildStore(10);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      (result.current as any).refetch();
      expect(mockRefetch).toHaveBeenCalledOnce();
    });
  });

  describe("success state with no readings", () => {
    it("returns empty selectedKeys when no readings are assigned", () => {
      const exercises: Exercise[] = [makeExercise()];
      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isError: false,
        data: exercises,
        refetch: vi.fn()
      } as any);

      const store = buildStore(10, [], []);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      const output = result.current as any;
      expect(output.readingExercises).toEqual([]);
      expect(output.selectedKeys).toEqual({});
    });
  });

  describe("success state with readings", () => {
    it("returns subchapter checked and chapter partially checked when some children are assigned", () => {
      const readingExercise = makeExercise({ subchapter: "sub1", reading_assignment: true });
      const exercises: Exercise[] = [readingExercise];

      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isError: false,
        data: exercises,
        refetch: vi.fn()
      } as any);

      const availableReadings: TreeNode[] = [
        {
          key: "ch1",
          label: "Chapter 1",
          children: [
            { key: "sub1", label: "Sub 1" },
            { key: "sub2", label: "Sub 2" }
          ]
        }
      ];

      const store = buildStore(10, [readingExercise], availableReadings);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      const output = result.current as any;
      expect(output.readingExercises).toHaveLength(1);
      expect(output.selectedKeys["sub1"]).toEqual({ checked: true, partialChecked: false });
      expect(output.selectedKeys["ch1"]).toEqual({ checked: false, partialChecked: true });
    });

    it("returns chapter fully checked when all children are assigned", () => {
      const ex1 = makeExercise({ id: 1, subchapter: "sub1", reading_assignment: true });
      const ex2 = makeExercise({ id: 2, subchapter: "sub2", reading_assignment: true });
      const exercises: Exercise[] = [ex1, ex2];

      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isError: false,
        data: exercises,
        refetch: vi.fn()
      } as any);

      const availableReadings: TreeNode[] = [
        {
          key: "ch1",
          label: "Chapter 1",
          children: [
            { key: "sub1", label: "Sub 1" },
            { key: "sub2", label: "Sub 2" }
          ]
        }
      ];

      const store = buildStore(10, [ex1, ex2], availableReadings);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      const output = result.current as any;
      expect(output.selectedKeys["ch1"]).toEqual({ checked: true, partialChecked: true });
      expect(output.selectedKeys["sub1"]).toEqual({ checked: true, partialChecked: false });
      expect(output.selectedKeys["sub2"]).toEqual({ checked: true, partialChecked: false });
    });

    it("returns chapter not checked when no children are assigned", () => {
      const exercises: Exercise[] = [makeExercise({ subchapter: "sub1" })];

      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isError: false,
        data: exercises,
        refetch: vi.fn()
      } as any);

      const availableReadings: TreeNode[] = [
        {
          key: "ch2",
          label: "Chapter 2",
          children: [{ key: "sub3", label: "Sub 3" }]
        }
      ];

      const store = buildStore(10, [], availableReadings);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      const output = result.current as any;
      expect(output.selectedKeys["ch2"]).toEqual({ checked: false, partialChecked: false });
    });

    it("skips query when selectedAssignmentId is null", () => {
      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isError: false,
        data: undefined,
        refetch: vi.fn()
      } as any);

      const store = buildStore(null, [], []);
      renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      expect(useGetExercisesQuery).toHaveBeenCalledWith(0, {
        skip: true,
        refetchOnMountOrArgChange: true
      });
    });

    it("passes assignment id and skip false when assignment is selected", () => {
      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isError: false,
        data: [],
        refetch: vi.fn()
      } as any);

      const store = buildStore(42, [], []);
      renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      expect(useGetExercisesQuery).toHaveBeenCalledWith(42, {
        skip: false,
        refetchOnMountOrArgChange: true
      });
    });

    it("reports loading while fetching data that belongs to another assignment", () => {
      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isFetching: true,
        isError: false,
        data: [],
        refetch: vi.fn()
      } as any);

      const store = buildStore(42, [makeExercise({ reading_assignment: true })], [], 41);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      expect(result.current.loading).toBe(true);
    });

    it("does not report loading when refetching data for the same assignment", () => {
      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isFetching: true,
        isError: false,
        data: [],
        refetch: vi.fn()
      } as any);

      const store = buildStore(42, [makeExercise({ reading_assignment: true })], [], 42);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      expect(result.current.loading).toBeUndefined();
      expect(result.current.readingExercises).toHaveLength(1);
    });

    it("returns readingExercises sorted by sorting_priority from store", () => {
      const ex1 = makeExercise({
        id: 1,
        subchapter: "sub1",
        sorting_priority: 2,
        reading_assignment: true
      });
      const ex2 = makeExercise({
        id: 2,
        subchapter: "sub2",
        sorting_priority: 1,
        reading_assignment: true
      });

      vi.mocked(useGetExercisesQuery).mockReturnValue({
        isLoading: false,
        isError: false,
        data: [ex1, ex2],
        refetch: vi.fn()
      } as any);

      const availableReadings: TreeNode[] = [
        {
          key: "ch1",
          label: "Chapter 1",
          children: [
            { key: "sub1", label: "Sub 1" },
            { key: "sub2", label: "Sub 2" }
          ]
        }
      ];

      const store = buildStore(10, [ex1, ex2], availableReadings);
      const { result } = renderHook(() => useReadingsSelector(), { wrapper: wrapper(store) });

      const output = result.current as any;
      expect(output.readingExercises[0].sorting_priority).toBe(1);
      expect(output.readingExercises[1].sorting_priority).toBe(2);
    });
  });
});
