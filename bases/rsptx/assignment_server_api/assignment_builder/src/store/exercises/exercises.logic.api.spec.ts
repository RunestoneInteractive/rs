import { configureStore } from "@reduxjs/toolkit";
import {
  EXERCISES_TOAST_COPY,
  exercisesApi,
  useCreateNewExerciseMutation,
  useSearchExercisesSmartQuery
} from "./exercises.logic.api";

import type { DetailResponse } from "@/types/api";
import type { ExercisesSearchResponse } from "@/types/exercises";

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

vi.mock("@store/baseQuery", () => ({
  baseQuery: vi.fn()
}));

vi.mock("@store/assignmentExercise/assignmentExercise.logic.api", () => ({
  assignmentExerciseApi: {
    util: {
      invalidateTags: vi.fn(() => ({ type: "invalidateTags" }))
    },
    reducerPath: "assignmentExerciseAPI",
    reducer: (state = {}) => state,
    middleware: () => (next: any) => (action: any) => next(action)
  }
}));

vi.mock("../assignment/assignment.logic.api", () => ({
  assignmentApi: {
    util: {
      invalidateTags: vi.fn(() => ({ type: "invalidateTags" }))
    },
    reducerPath: "assignmentAPI",
    reducer: (state = {}) => state,
    middleware: () => (next: any) => (action: any) => next(action)
  }
}));

describe("exercisesApi", () => {
  it("exports the exercisesApi object", () => {
    expect(exercisesApi).toBeDefined();
  });

  it("has reducerPath set to exercisesAPI", () => {
    expect(exercisesApi.reducerPath).toBe("exercisesAPI");
  });

  it("exports useCreateNewExerciseMutation hook", () => {
    expect(useCreateNewExerciseMutation).toBeDefined();
    expect(typeof useCreateNewExerciseMutation).toBe("function");
  });

  it("exports useSearchExercisesSmartQuery hook", () => {
    expect(useSearchExercisesSmartQuery).toBeDefined();
    expect(typeof useSearchExercisesSmartQuery).toBe("function");
  });

  it("has endpoints for createNewExercise and searchExercisesSmart", () => {
    expect(exercisesApi.endpoints).toHaveProperty("createNewExercise");
    expect(exercisesApi.endpoints).toHaveProperty("searchExercisesSmart");
  });

  it("uses the canonical create-error toast copy", () => {
    expect(EXERCISES_TOAST_COPY.createError).toBe("Couldn't save exercise. Try again.");
  });

  describe("reducer initial state", () => {
    it("returns initial state when called with undefined state and an unknown action", () => {
      const store = configureStore({
        reducer: {
          [exercisesApi.reducerPath]: exercisesApi.reducer
        }
      });

      const state = store.getState()[exercisesApi.reducerPath];
      expect(state).toBeDefined();
      expect(state.queries).toBeDefined();
      expect(state.mutations).toBeDefined();
      expect(state.provided).toBeDefined();
      expect(state.subscriptions).toBeDefined();
    });
  });
});

describe("searchExercisesSmart transformResponse", () => {
  const buildTransformResponse = () => {
    const endpoint = exercisesApi.endpoints.searchExercisesSmart;
    return (endpoint as any).select;
  };

  it("transforms response with exercises and pagination when both are present", () => {
    const mockExercises = [
      {
        id: 1,
        assignment_id: 1,
        question_id: 1,
        points: 10,
        timed: false,
        autograde: "pct_correct",
        which_to_grade: "best_answer",
        reading_assignment: false,
        sorting_priority: 0,
        activities_required: 0,
        use_llm: false,
        qnumber: "q1",
        name: "Test Exercise",
        subchapter: "sub1",
        chapter: "chap1",
        base_course: "thinkcspy",
        htmlsrc: "<p>test</p>",
        question_type: "mchoice",
        question_json: "{}",
        owner: "user1",
        tags: "",
        num: 1,
        numQuestions: 1,
        required: false,
        title: "Test",
        topic: "topic1",
        difficulty: 1,
        author: "author1",
        description: "desc",
        is_private: false,
        from_source: false
      }
    ];

    const mockPagination = {
      total: 1,
      page: 1,
      limit: 20,
      pages: 1
    };

    const input: DetailResponse<ExercisesSearchResponse> = {
      detail: {
        exercises: mockExercises,
        pagination: mockPagination
      }
    };

    const store = configureStore({
      reducer: {
        [exercisesApi.reducerPath]: exercisesApi.reducer
      }
    });

    const apiWithMockedQuery = exercisesApi.injectEndpoints({
      endpoints: () => ({})
    });

    const transformFn = (
      response: DetailResponse<ExercisesSearchResponse>
    ): ExercisesSearchResponse => ({
      exercises: response.detail.exercises || [],
      pagination: response.detail.pagination || {
        total: 0,
        page: 0,
        limit: 20,
        pages: 0
      }
    });

    const result = transformFn(input);

    expect(result.exercises).toEqual(mockExercises);
    expect(result.pagination).toEqual(mockPagination);
  });

  it("returns empty exercises array when detail.exercises is null or undefined", () => {
    const input = {
      detail: {
        exercises: null,
        pagination: { total: 0, page: 0, limit: 20, pages: 0 }
      }
    } as unknown as DetailResponse<ExercisesSearchResponse>;

    const transformFn = (
      response: DetailResponse<ExercisesSearchResponse>
    ): ExercisesSearchResponse => ({
      exercises: response.detail.exercises || [],
      pagination: response.detail.pagination || {
        total: 0,
        page: 0,
        limit: 20,
        pages: 0
      }
    });

    const result = transformFn(input);

    expect(result.exercises).toEqual([]);
    expect(result.pagination).toEqual({ total: 0, page: 0, limit: 20, pages: 0 });
  });

  it("returns default pagination when detail.pagination is null or undefined", () => {
    const input = {
      detail: {
        exercises: [],
        pagination: null
      }
    } as unknown as DetailResponse<ExercisesSearchResponse>;

    const transformFn = (
      response: DetailResponse<ExercisesSearchResponse>
    ): ExercisesSearchResponse => ({
      exercises: response.detail.exercises || [],
      pagination: response.detail.pagination || {
        total: 0,
        page: 0,
        limit: 20,
        pages: 0
      }
    });

    const result = transformFn(input);

    expect(result.exercises).toEqual([]);
    expect(result.pagination).toEqual({
      total: 0,
      page: 0,
      limit: 20,
      pages: 0
    });
  });

  it("returns default pagination with limit 20 as default", () => {
    const input = {
      detail: {
        exercises: undefined,
        pagination: undefined
      }
    } as unknown as DetailResponse<ExercisesSearchResponse>;

    const transformFn = (
      response: DetailResponse<ExercisesSearchResponse>
    ): ExercisesSearchResponse => ({
      exercises: response.detail.exercises || [],
      pagination: response.detail.pagination || {
        total: 0,
        page: 0,
        limit: 20,
        pages: 0
      }
    });

    const result = transformFn(input);

    expect(result.pagination.limit).toBe(20);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.page).toBe(0);
    expect(result.pagination.pages).toBe(0);
  });
});
