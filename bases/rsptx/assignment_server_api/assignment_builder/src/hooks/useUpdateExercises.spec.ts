import { renderHook, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { createElement } from "react";
import { assignmentExerciseSlice } from "@store/assignmentExercise/assignmentExercise.logic";
import { useUpdateExercises } from "./useUpdateExercises";

vi.mock("@store/assignmentExercise/assignmentExercise.logic.api", () => ({
  useUpdateAssignmentQuestionsMutation: vi.fn()
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

import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { notify } from "@components/ui/notify";

const mockExercise = {
  id: 1,
  assignment_id: 10,
  question_id: 100,
  points: 5,
  timed: false,
  autograde: "all_or_nothing",
  which_to_grade: "best_answer",
  reading_assignment: false,
  sorting_priority: 1,
  activities_required: 0,
  use_llm: false,
  qnumber: "q1",
  name: "exercise-1",
  subchapter: "sub1",
  chapter: "ch1",
  base_course: "course1",
  htmlsrc: "<p>test</p>",
  question_type: "mchoice",
  question_json: JSON.stringify({ statement: "What is 2+2?" }),
  owner: "author1",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Exercise 1",
  topic: "math",
  difficulty: 1,
  author: "author1",
  description: "A test exercise",
  is_private: false,
  from_source: false
};

function buildStore(exercises = [mockExercise]) {
  return configureStore({
    reducer: {
      assignmentExercise: assignmentExerciseSlice.reducer
    },
    preloadedState: {
      assignmentExercise: { assignmentExercises: exercises, forAssignmentId: null }
    }
  });
}

function wrapper(store: ReturnType<typeof buildStore>) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(Provider, { store }, children);
}

describe("useUpdateExercises", () => {
  let mockUpdateExercises: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdateExercises = vi.fn().mockResolvedValue({ error: undefined });

    vi.mocked(useUpdateAssignmentQuestionsMutation).mockReturnValue([
      mockUpdateExercises,
      {} as any
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns handleChange function", () => {
    const store = buildStore();
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    expect(typeof result.current.handleChange).toBe("function");
  });

  it("shows error toast when exercise is not found", async () => {
    const store = buildStore([]);
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    await act(async () => {
      await result.current.handleChange(999, "points", 10);
    });

    expect(notify.error).toHaveBeenCalledWith("This exercise is no longer in the assignment");
    expect(mockUpdateExercises).not.toHaveBeenCalled();
  });

  it("does not call updateExercises when value is unchanged", async () => {
    const store = buildStore([mockExercise]);
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    await act(async () => {
      await result.current.handleChange(1, "points", 5);
    });

    expect(mockUpdateExercises).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("calls updateExercises with updated exercise when value changes", async () => {
    const store = buildStore([mockExercise]);
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    await act(async () => {
      await result.current.handleChange(1, "points", 20);
    });

    expect(mockUpdateExercises).toHaveBeenCalledOnce();
    const calledWith = mockUpdateExercises.mock.calls[0][0];
    expect(calledWith).toHaveLength(1);
    expect(calledWith[0].points).toBe(20);
    expect(calledWith[0].id).toBe(1);
  });

  it("serializes question_json to string when calling updateExercises", async () => {
    const exerciseWithParsedJson = {
      ...mockExercise,
      question_json: { statement: "Parsed object" } as any
    };
    const store = buildStore([exerciseWithParsedJson]);
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    await act(async () => {
      await result.current.handleChange(1, "points", 15);
    });

    const calledWith = mockUpdateExercises.mock.calls[0][0];
    expect(typeof calledWith[0].question_json).toBe("string");
    expect(calledWith[0].question_json).toBe(JSON.stringify({ statement: "Parsed object" }));
  });

  it("shows success toast when update succeeds", async () => {
    mockUpdateExercises.mockResolvedValue({ error: undefined });
    const store = buildStore([mockExercise]);
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    await act(async () => {
      await result.current.handleChange(1, "points", 20);
    });

    expect(notify.success).toHaveBeenCalledWith("Exercise updated");
  });

  it("shows error toast when update fails", async () => {
    mockUpdateExercises.mockResolvedValue({ error: new Error("Network error") });
    const store = buildStore([mockExercise]);
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    await act(async () => {
      await result.current.handleChange(1, "points", 20);
    });

    expect(notify.error).toHaveBeenCalledWith("Couldn't update exercise. Try again.");
  });

  it("updates the correct field when autograde changes", async () => {
    const store = buildStore([mockExercise]);
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    await act(async () => {
      await result.current.handleChange(1, "autograde", "pct_correct");
    });

    const calledWith = mockUpdateExercises.mock.calls[0][0];
    expect(calledWith[0].autograde).toBe("pct_correct");
  });

  it("updates which_to_grade field correctly", async () => {
    const store = buildStore([mockExercise]);
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    await act(async () => {
      await result.current.handleChange(1, "which_to_grade", "first_answer");
    });

    const calledWith = mockUpdateExercises.mock.calls[0][0];
    expect(calledWith[0].which_to_grade).toBe("first_answer");
  });

  it("updates activities_required field correctly", async () => {
    const store = buildStore([mockExercise]);
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    await act(async () => {
      await result.current.handleChange(1, "activities_required", 3);
    });

    const calledWith = mockUpdateExercises.mock.calls[0][0];
    expect(calledWith[0].activities_required).toBe(3);
  });

  it("preserves all other exercise fields when updating", async () => {
    const store = buildStore([mockExercise]);
    const { result } = renderHook(() => useUpdateExercises(), {
      wrapper: wrapper(store)
    });

    await act(async () => {
      await result.current.handleChange(1, "points", 10);
    });

    const calledWith = mockUpdateExercises.mock.calls[0][0];
    const updated = calledWith[0];
    expect(updated.id).toBe(mockExercise.id);
    expect(updated.assignment_id).toBe(mockExercise.assignment_id);
    expect(updated.name).toBe(mockExercise.name);
    expect(updated.question_type).toBe(mockExercise.question_type);
  });
});
