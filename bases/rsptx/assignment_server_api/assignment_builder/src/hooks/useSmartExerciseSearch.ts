import { assignmentSelectors } from "@store/assignment/assignment.logic";
import { useSearchExercisesSmartQuery } from "@store/exercises/exercises.logic.api";
import debounce from "lodash/debounce";
import { FilterMatchMode, FilterOperator } from "primereact/api";
import {
  DataTableFilterMeta,
  DataTablePageEvent,
  DataTableSortEvent,
  DataTableStateEvent
} from "primereact/datatable";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { ExercisesSearchRequest, FilterValue } from "@/types/exercises";

/**
 * Hook for smart exercise search with support for pagination, filtering, sorting
 * Enhanced with debounced operations and better UX
 */
export const useSmartExerciseSearch = (initialParams?: Partial<ExercisesSearchRequest>) => {
  // Get current assignment ID to filter out already assigned exercises
  const selectedAssignmentId = useSelector(assignmentSelectors.getSelectedAssignmentId);

  // Search parameters state with default values
  const [searchParams, setSearchParams] = useState<ExercisesSearchRequest>({
    // Base course handling
    use_base_course: true,

    // Assignment ID to filter out exercises already attached
    assignment_id: selectedAssignmentId || undefined,

    // Pagination
    page: 0,
    limit: 20,

    // Sorting
    sorting: {
      field: "name",
      order: 1
    },

    // Filters
    filters: {},

    // Apply any initial params
    ...initialParams
  });

  // API request to get data
  const { data, isLoading, isError, refetch, isFetching, error } =
    useSearchExercisesSmartQuery(searchParams);

  // Create debounced function for delayed search on text input
  const debouncedSearch = useRef(
    debounce((params: Partial<ExercisesSearchRequest>) => {
      setSearchParams((prevParams) => ({
        ...prevParams,
        ...params,
        // Reset to first page when search parameters change
        page: params.page !== undefined ? params.page : 0
      }));
    }, 300)
  ).current;

  // Create debounced function for filters with shorter delay
  const debouncedFilter = useRef(
    debounce((newFilters: Record<string, FilterValue | FilterValue[] | null>) => {
      setSearchParams((prevParams) => ({
        ...prevParams,
        filters: {
          ...prevParams.filters,
          ...newFilters
        },
        page: 0 // Reset to first page when filters change
      }));
    }, 300)
  ).current;

  // Ensure debounce functions are cleared when component unmounts
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
      debouncedFilter.cancel();
    };
  }, [debouncedSearch, debouncedFilter]);

  // Function to update filters
  const updateFilters = useCallback(
    (newFilters: Record<string, any>) => {
      setFilters((prevFilters) => ({
        ...prevFilters,
        ...newFilters
      }));
      debouncedFilter(newFilters);
    },
    [debouncedFilter]
  );

  // Function to update sorting
  const updateSorting = useCallback((field: string, order: number) => {
    setSearchParams((prevParams) => ({
      ...prevParams,
      sorting: {
        field,
        order
      }
    }));
  }, []);

  // Function to update pagination
  const updatePagination = useCallback((page: number, limit?: number) => {
    setSearchParams((prevParams) => ({
      ...prevParams,
      page,
      limit: limit !== undefined ? limit : prevParams.limit
    }));
  }, []);

  // Combine loading states for better UX
  const loading = isLoading || isFetching;

  // Track if data is loading for the first time vs subsequent loads
  const [initialLoading, setInitialLoading] = useState(true);

  // Local state for filters
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    question_type: { value: null, matchMode: FilterMatchMode.IN },
    author: { value: null, matchMode: FilterMatchMode.CONTAINS },
    topic: { value: null, matchMode: FilterMatchMode.CONTAINS }
  });

  // Set initial loading state
  useEffect(() => {
    if (!loading && initialLoading) {
      setInitialLoading(false);
    }
  }, [loading, initialLoading]);

  // Global filter change handler
  const onGlobalFilterChange = (value: string) => {
    updateFilters({ global: { value, matchMode: FilterMatchMode.CONTAINS } });
  };

  // Page change handler
  const onPage = (event: DataTablePageEvent) => {
    updatePagination(event.page as number, event.rows as number);
  };

  // Sort change handler
  const onSort = (event: DataTableSortEvent) => {
    updateSorting(event.sortField, event.sortOrder === 1 ? 1 : -1);
  };

  // Filter change handler for DataTable
  const onFilter = (event: DataTableStateEvent) => {
    console.log(event);
    updateFilters(event.filters);
  };

  return {
    // Result data
    exercises: data?.exercises || [],
    pagination: data?.pagination,

    // Loading state
    loading,
    initialLoading,
    error: isError ? error : null,

    // State and actions
    searchParams,
    filters,
    updateFilters,
    onGlobalFilterChange,
    onPage,
    onSort,
    onFilter,

    // Raw action to refetch data
    refetch
  };
};
