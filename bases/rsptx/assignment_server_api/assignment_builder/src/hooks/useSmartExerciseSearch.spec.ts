import { renderHook, act } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { FilterMatchMode } from "@/types/filterMatchMode";
import { setupStore } from "@store/store";
import { useSmartExerciseSearch } from "./useSmartExerciseSearch";

const mockQueryResult: {
  data: any;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: any;
  refetch: ReturnType<typeof vi.fn>;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: undefined,
  refetch: vi.fn()
};

vi.mock("@store/exercises/exercises.logic.api", () => ({
  useSearchExercisesSmartQuery: vi.fn(() => mockQueryResult),
  exercisesApi: {
    reducerPath: "exercisesApi",
    reducer: (state = {}) => state,
    middleware: () => (next: any) => (action: any) => next(action)
  }
}));

vi.mock("@store/assignment/assignment.logic", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@store/assignment/assignment.logic")>();
  return {
    ...actual,
    assignmentSelectors: {
      ...actual.assignmentSelectors,
      getSelectedAssignmentId: (state: any) => state?.assignment?.selectedAssignmentId ?? null
    }
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(Provider, { store: setupStore() }, children);

describe("useSmartExerciseSearch", () => {
  describe("initial state", () => {
    it("returns empty exercises array when data is undefined", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.exercises).toEqual([]);
    });

    it("returns undefined pagination when data is undefined", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.pagination).toBeUndefined();
    });

    it("returns loading as false when both isLoading and isFetching are false", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.loading).toBe(false);
    });

    it("returns null error when isError is false", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.error).toBeNull();
    });

    it("exposes a refetch function", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(typeof result.current.refetch).toBe("function");
    });

    it("initializes searchParams with default values", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.searchParams.page).toBe(0);
      expect(result.current.searchParams.limit).toBe(20);
      expect(result.current.searchParams.use_base_course).toBe(true);
      expect(result.current.searchParams.sorting).toEqual({ field: "name", order: 1 });
      expect(result.current.searchParams.filters).toEqual({});
    });

    it("applies initialParams over default values", () => {
      const { result } = renderHook(() => useSmartExerciseSearch({ page: 2, limit: 50 }), {
        wrapper
      });

      expect(result.current.searchParams.page).toBe(2);
      expect(result.current.searchParams.limit).toBe(50);
    });

    it("initializes filters with global, name, question_type, author, and topic fields", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });
      const { filters } = result.current;

      expect(filters).toHaveProperty("global");
      expect(filters).toHaveProperty("name");
      expect(filters).toHaveProperty("question_type");
      expect(filters).toHaveProperty("author");
      expect(filters).toHaveProperty("topic");
    });

    it("initializes global filter with null value and CONTAINS match mode", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      const globalFilter = result.current.filters.global as { value: unknown; matchMode: string };
      expect(globalFilter.value).toBeNull();
      expect(globalFilter.matchMode).toBe(FilterMatchMode.CONTAINS);
    });
  });

  describe("updateFilters", () => {
    it("merges new filter values into the existing filters state", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      act(() => {
        result.current.updateFilters({
          name: { value: "test", matchMode: FilterMatchMode.CONTAINS }
        });
      });

      const nameFilter = result.current.filters.name as { value: unknown };
      expect(nameFilter.value).toBe("test");
    });

    it("preserves existing filter fields when merging new filters", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      act(() => {
        result.current.updateFilters({
          name: { value: "test", matchMode: FilterMatchMode.CONTAINS }
        });
      });

      expect(result.current.filters).toHaveProperty("global");
      expect(result.current.filters).toHaveProperty("author");
    });
  });

  describe("onGlobalFilterChange", () => {
    it("updates the global filter value", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      act(() => {
        result.current.onGlobalFilterChange("search term");
      });

      const globalFilter = result.current.filters.global as { value: unknown; matchMode: string };
      expect(globalFilter.value).toBe("search term");
      expect(globalFilter.matchMode).toBe(FilterMatchMode.CONTAINS);
    });
  });

  describe("onPage", () => {
    it("updates page and limit from the DataTablePageEvent", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      act(() => {
        result.current.onPage({ page: 3, rows: 30 } as any);
      });

      expect(result.current.searchParams.page).toBe(3);
      expect(result.current.searchParams.limit).toBe(30);
    });
  });

  describe("onSort", () => {
    it("updates sorting field and order from the DataTableSortEvent with ascending order", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      act(() => {
        result.current.onSort({ sortField: "author", sortOrder: 1 } as any);
      });

      expect(result.current.searchParams.sorting).toEqual({ field: "author", order: 1 });
    });

    it("maps sortOrder not equal to 1 to descending order (-1)", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      act(() => {
        result.current.onSort({ sortField: "name", sortOrder: -1 } as any);
      });

      expect(result.current.searchParams.sorting).toEqual({ field: "name", order: -1 });
    });

    it("maps sortOrder 0 to descending order (-1)", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      act(() => {
        result.current.onSort({ sortField: "topic", sortOrder: 0 } as any);
      });

      expect(result.current.searchParams.sorting).toEqual({ field: "topic", order: -1 });
    });
  });

  describe("toggleBaseCourse", () => {
    it("sets use_base_course to false and resets page to 0", () => {
      const { result } = renderHook(() => useSmartExerciseSearch({ page: 3 }), { wrapper });

      act(() => {
        result.current.toggleBaseCourse(false);
      });

      expect(result.current.searchParams.use_base_course).toBe(false);
      expect(result.current.searchParams.page).toBe(0);
    });

    it("sets use_base_course to true", () => {
      const { result } = renderHook(() => useSmartExerciseSearch({ use_base_course: false }), {
        wrapper
      });

      act(() => {
        result.current.toggleBaseCourse(true);
      });

      expect(result.current.searchParams.use_base_course).toBe(true);
    });
  });

  describe("when RTK Query returns data", () => {
    afterEach(() => {
      mockQueryResult.data = undefined;
      mockQueryResult.isLoading = false;
      mockQueryResult.isError = false;
      mockQueryResult.isFetching = false;
      mockQueryResult.error = undefined;
    });

    it("returns exercises from the data response", () => {
      mockQueryResult.data = {
        exercises: [{ id: 1, name: "exercise-one" }],
        pagination: { total: 1, page: 0, limit: 20, pages: 1 }
      };

      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.exercises).toHaveLength(1);
      expect(result.current.exercises[0]).toMatchObject({ id: 1, name: "exercise-one" });
    });

    it("returns pagination metadata from the data response", () => {
      mockQueryResult.data = {
        exercises: [],
        pagination: { total: 42, page: 1, limit: 20, pages: 3 }
      };

      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.pagination).toEqual({ total: 42, page: 1, limit: 20, pages: 3 });
    });

    it("returns loading as true when isLoading is true", () => {
      mockQueryResult.isLoading = true;

      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.loading).toBe(true);
    });

    it("returns loading as true when isFetching is true", () => {
      mockQueryResult.isFetching = true;

      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.loading).toBe(true);
    });

    it("returns error when isError is true", () => {
      const fakeError = new Error("fetch failed");
      mockQueryResult.isError = true;
      mockQueryResult.error = fakeError;

      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.error).toBe(fakeError);
    });
  });

  describe("initialLoading state", () => {
    afterEach(() => {
      mockQueryResult.isLoading = false;
      mockQueryResult.isFetching = false;
    });

    it("remains true while loading is ongoing", () => {
      mockQueryResult.isLoading = true;

      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.initialLoading).toBe(true);
    });

    it("becomes false once loading completes", () => {
      mockQueryResult.isLoading = false;
      mockQueryResult.isFetching = false;

      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      expect(result.current.initialLoading).toBe(false);
    });
  });

  describe("updatePagination via onPage", () => {
    it("retains current limit when rows is not provided (uses current)", () => {
      const { result } = renderHook(() => useSmartExerciseSearch({ limit: 25 }), { wrapper });

      act(() => {
        result.current.onPage({ page: 1, rows: 25 } as any);
      });

      expect(result.current.searchParams.page).toBe(1);
      expect(result.current.searchParams.limit).toBe(25);
    });
  });

  describe("updateSorting", () => {
    it("sets the sorting field and order directly", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      act(() => {
        result.current.updateSorting("author", -1);
      });

      expect(result.current.searchParams.sorting).toEqual({ field: "author", order: -1 });
    });
  });

  describe("updatePagination", () => {
    it("updates page and keeps the current limit when limit is omitted", () => {
      const { result } = renderHook(() => useSmartExerciseSearch({ limit: 50 }), { wrapper });

      act(() => {
        result.current.updatePagination(2);
      });

      expect(result.current.searchParams.page).toBe(2);
      expect(result.current.searchParams.limit).toBe(50);
    });

    it("updates both page and limit when provided", () => {
      const { result } = renderHook(() => useSmartExerciseSearch(), { wrapper });

      act(() => {
        result.current.updatePagination(1, 10);
      });

      expect(result.current.searchParams.page).toBe(1);
      expect(result.current.searchParams.limit).toBe(10);
    });
  });
});
