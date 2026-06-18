import { configureStore } from "@reduxjs/toolkit";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";

import { assignmentSlice, assignmentActions } from "@store/assignment/assignment.logic";
import { assignmentApi } from "@store/assignment/assignment.logic.api";
import { useSelectedAssignment } from "./useSelectedAssignment";

vi.mock("@store/assignment/assignment.logic.api", () => ({
  assignmentApi: {
    reducerPath: "assignmentAPI",
    reducer: (state = {}) => state,
    middleware: () => (next: (action: unknown) => unknown) => (action: unknown) => next(action)
  },
  useGetAssignmentQuery: vi.fn(),
  useUpdateAssignmentMutation: vi.fn()
}));

import {
  useGetAssignmentQuery,
  useUpdateAssignmentMutation
} from "@store/assignment/assignment.logic.api";

const mockPutAssignment = vi.fn();

function makeStore(selectedAssignmentId: number | null = null) {
  return configureStore({
    reducer: {
      assignmentTemp: assignmentSlice.reducer,
      assignmentAPI: (state = {}) => state
    },
    preloadedState: {
      assignmentTemp: { selectedAssignmentId }
    }
  });
}

function makeWrapper(store: ReturnType<typeof makeStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store }, children);
  };
}

beforeEach(() => {
  vi.mocked(useUpdateAssignmentMutation).mockReturnValue([mockPutAssignment, {} as any]);
  vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: undefined } as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSelectedAssignment", () => {
  describe("selectedAssignment", () => {
    it("returns undefined when no assignment ID is selected", () => {
      const store = makeStore(null);
      vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: undefined } as any);

      const { result } = renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      expect(result.current.selectedAssignment).toBeUndefined();
    });

    it("returns the assignment data when an assignment ID is selected and query resolves", () => {
      const mockAssignment = {
        id: 42,
        name: "Test Assignment",
        description: "desc",
        duedate: "2025-01-01",
        points: 10
      } as any;

      const store = makeStore(42);
      vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: mockAssignment } as any);

      const { result } = renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      expect(result.current.selectedAssignment).toEqual(mockAssignment);
    });

    it("calls useGetAssignmentQuery with skip:true when no assignment ID is set", () => {
      const store = makeStore(null);

      renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      expect(useGetAssignmentQuery).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ skip: true })
      );
    });

    it("calls useGetAssignmentQuery with skip:false when an assignment ID is set", () => {
      const store = makeStore(5);

      renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      expect(useGetAssignmentQuery).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ skip: false })
      );
    });
  });

  describe("updateAssignment", () => {
    it("returns an updateAssignment function", () => {
      const store = makeStore(null);

      const { result } = renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      expect(typeof result.current.updateAssignment).toBe("function");
    });

    it("does not call putAssignment immediately when updateAssignment is called", () => {
      const store = makeStore(1);
      const mockAssignment = { id: 1, name: "Original" } as any;
      vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: mockAssignment } as any);

      const { result } = renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      act(() => {
        result.current.updateAssignment({ name: "Updated" });
      });

      expect(mockPutAssignment).not.toHaveBeenCalled();
    });

    it("calls putAssignment with merged assignment data after the debounce delay", async () => {
      vi.useFakeTimers();

      const store = makeStore(1);
      const mockAssignment = { id: 1, name: "Original", points: 5 } as any;
      vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: mockAssignment } as any);

      const { result } = renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      act(() => {
        result.current.updateAssignment({ name: "Updated" });
      });

      expect(mockPutAssignment).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockPutAssignment).toHaveBeenCalledTimes(1);
      expect(mockPutAssignment).toHaveBeenCalledWith({
        id: 1,
        name: "Updated",
        points: 5
      });

      vi.useRealTimers();
    });

    it("debounces multiple rapid calls and only fires once after the final call", async () => {
      vi.useFakeTimers();

      const store = makeStore(1);
      const mockAssignment = { id: 1, name: "Original", points: 5 } as any;
      vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: mockAssignment } as any);

      const { result } = renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      act(() => {
        result.current.updateAssignment({ name: "First" });
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      act(() => {
        result.current.updateAssignment({ name: "Second" });
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      act(() => {
        result.current.updateAssignment({ name: "Third" });
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockPutAssignment).toHaveBeenCalledTimes(1);
      expect(mockPutAssignment).toHaveBeenCalledWith(expect.objectContaining({ name: "Third" }));

      vi.useRealTimers();
    });

    it("does not call putAssignment when assignment ID is null even after the debounce fires", () => {
      vi.useFakeTimers();

      const store = makeStore(null);
      vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: undefined } as any);

      const { result } = renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      act(() => {
        result.current.updateAssignment({ name: "Updated" });
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockPutAssignment).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("does not call putAssignment when assignment data is undefined even after the debounce fires", () => {
      vi.useFakeTimers();

      const store = makeStore(1);
      vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: undefined } as any);

      const { result } = renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      act(() => {
        result.current.updateAssignment({ name: "Updated" });
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockPutAssignment).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("uses the latest assignment data when updateAssignment fires after a state change", () => {
      vi.useFakeTimers();

      const store = makeStore(1);
      const initialAssignment = { id: 1, name: "Original", description: "desc" } as any;
      const updatedAssignment = { id: 1, name: "LatestFromServer", description: "desc" } as any;

      vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: initialAssignment } as any);

      const { result, rerender } = renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      act(() => {
        result.current.updateAssignment({ description: "new desc" });
      });

      vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: updatedAssignment } as any);
      rerender();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockPutAssignment).toHaveBeenCalledWith({
        id: 1,
        name: "LatestFromServer",
        description: "new desc"
      });

      vi.useRealTimers();
    });

    it("uses the latest assignment ID when it changes before the debounce fires", () => {
      vi.useFakeTimers();

      const store = makeStore(1);
      const assignment = { id: 2, name: "Assignment2", points: 10 } as any;

      vi.mocked(useGetAssignmentQuery).mockReturnValue({ data: assignment } as any);

      const { result } = renderHook(() => useSelectedAssignment(), {
        wrapper: makeWrapper(store)
      });

      act(() => {
        result.current.updateAssignment({ points: 20 });
      });

      act(() => {
        store.dispatch(assignmentActions.setSelectedAssignmentId(2));
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockPutAssignment).toHaveBeenCalledWith(expect.objectContaining({ points: 20 }));

      vi.useRealTimers();
    });
  });
});
