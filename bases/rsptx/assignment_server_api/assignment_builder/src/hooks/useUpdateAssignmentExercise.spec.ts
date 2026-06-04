import { renderHook, act } from "@testing-library/react";
import { vi, beforeEach } from "vitest";

const mockUpdateAssignmentExercisesPut = vi.fn();
const mockSelectedAssignment = { id: 42 };

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

vi.mock("@store/assignmentExercise/assignmentExercise.logic.api", () => ({
  useUpdateAssignmentExercisesMutation: () => [
    mockUpdateAssignmentExercisesPut,
    { isLoading: true }
  ]
}));

vi.mock("@/hooks/useSelectedAssignment", () => ({
  useSelectedAssignment: () => ({ selectedAssignment: mockSelectedAssignment })
}));

import { notify } from "@components/ui/notify";

import {
  getExercisesUpdateMessage,
  useUpdateAssignmentExercise
} from "./useUpdateAssignmentExercise";

describe("getExercisesUpdateMessage", () => {
  it("pluralizes the add-only message", () => {
    expect(getExercisesUpdateMessage(1, 0)).toBe("Added 1 exercise");
    expect(getExercisesUpdateMessage(4, 0)).toBe("Added 4 exercises");
  });

  it("pluralizes the remove-only message", () => {
    expect(getExercisesUpdateMessage(0, 1)).toBe("Removed 1 exercise");
    expect(getExercisesUpdateMessage(0, 3)).toBe("Removed 3 exercises");
  });

  it("combines both counts into one sentence with the noun agreeing with the removed count", () => {
    expect(getExercisesUpdateMessage(2, 1)).toBe("Added 2, removed 1 exercise");
    expect(getExercisesUpdateMessage(1, 2)).toBe("Added 1, removed 2 exercises");
  });
});

describe("useUpdateAssignmentExercise", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns updateAssignmentExercises function", () => {
    const { result } = renderHook(() => useUpdateAssignmentExercise());
    expect(typeof result.current.updateAssignmentExercises).toBe("function");
  });

  it("exposes the mutation loading state as isUpdating", () => {
    const { result } = renderHook(() => useUpdateAssignmentExercise());
    expect(result.current.isUpdating).toBe(true);
  });

  it("does nothing when both idsToAdd and idsToRemove are empty", async () => {
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises({
        isReading: false,
        idsToAdd: [],
        idsToRemove: []
      });
    });

    expect(mockUpdateAssignmentExercisesPut).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("does nothing when idsToAdd and idsToRemove are omitted (defaults to empty)", async () => {
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises({ isReading: false } as any);
    });

    expect(mockUpdateAssignmentExercisesPut).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("calls mutation with correct payload when idsToAdd is non-empty", async () => {
    mockUpdateAssignmentExercisesPut.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises({
        isReading: false,
        idsToAdd: [1, 2],
        idsToRemove: []
      });
    });

    expect(mockUpdateAssignmentExercisesPut).toHaveBeenCalledWith({
      assignmentId: 42,
      isReading: false,
      idsToAdd: [1, 2],
      idsToRemove: []
    });
  });

  it("calls mutation with correct payload when idsToRemove is non-empty", async () => {
    mockUpdateAssignmentExercisesPut.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises({
        isReading: true,
        idsToAdd: [],
        idsToRemove: [3, 4]
      });
    });

    expect(mockUpdateAssignmentExercisesPut).toHaveBeenCalledWith({
      assignmentId: 42,
      isReading: true,
      idsToAdd: [],
      idsToRemove: [3, 4]
    });
  });

  it("shows error toast when mutation returns an error", async () => {
    mockUpdateAssignmentExercisesPut.mockResolvedValue({ error: { message: "server error" } });
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises({
        isReading: false,
        idsToAdd: [1],
        idsToRemove: []
      });
    });

    expect(notify.error).toHaveBeenCalledWith("Couldn't update exercises. Try again.");
  });

  it("does not call onSuccess when mutation returns an error", async () => {
    mockUpdateAssignmentExercisesPut.mockResolvedValue({ error: { message: "server error" } });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises(
        { isReading: false, idsToAdd: [1], idsToRemove: [] },
        onSuccess
      );
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("toasts 'Added {n} exercises' when only idsToAdd is provided", async () => {
    mockUpdateAssignmentExercisesPut.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises({
        isReading: false,
        idsToAdd: [1, 2, 3],
        idsToRemove: []
      });
    });

    expect(notify.success).toHaveBeenCalledWith("Added 3 exercises");
  });

  it("uses the singular noun when adding one exercise", async () => {
    mockUpdateAssignmentExercisesPut.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises({
        isReading: false,
        idsToAdd: [1],
        idsToRemove: []
      });
    });

    expect(notify.success).toHaveBeenCalledWith("Added 1 exercise");
  });

  it("toasts 'Removed {n} exercises' when only idsToRemove is provided", async () => {
    mockUpdateAssignmentExercisesPut.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises({
        isReading: false,
        idsToAdd: [],
        idsToRemove: [5, 6]
      });
    });

    expect(notify.success).toHaveBeenCalledWith("Removed 2 exercises");
  });

  it("toasts one clean sentence with both counts when both arrays are non-empty", async () => {
    mockUpdateAssignmentExercisesPut.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises({
        isReading: false,
        idsToAdd: [1],
        idsToRemove: [2, 3]
      });
    });

    const message = vi.mocked(notify.success).mock.calls[0][0];
    expect(message).toBe("Added 1, removed 2 exercises");
    expect(message).not.toContain("\n");
  });

  it("calls onSuccess after a successful mutation", async () => {
    mockUpdateAssignmentExercisesPut.mockResolvedValue({ data: {} });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    await act(async () => {
      await result.current.updateAssignmentExercises(
        { isReading: false, idsToAdd: [1], idsToRemove: [] },
        onSuccess
      );
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("returns the mutation response on success", async () => {
    const mutationResponse = { data: { updated: true } };
    mockUpdateAssignmentExercisesPut.mockResolvedValue(mutationResponse);
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.updateAssignmentExercises({
        isReading: false,
        idsToAdd: [1],
        idsToRemove: []
      });
    });

    expect(returnValue).toBe(mutationResponse);
  });

  it("returns undefined when mutation errors out", async () => {
    mockUpdateAssignmentExercisesPut.mockResolvedValue({ error: "something went wrong" });
    const { result } = renderHook(() => useUpdateAssignmentExercise());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.updateAssignmentExercises({
        isReading: false,
        idsToAdd: [1],
        idsToRemove: []
      });
    });

    expect(returnValue).toBeUndefined();
  });
});
