import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";

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
  useUpdateAssignmentQuestionsMutation: vi.fn()
}));

vi.mock("@/hooks/useReadingsSelector", () => ({
  useReadingsSelector: vi.fn()
}));

import { notify } from "@components/ui/notify";
import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { useReadingsSelector } from "@/hooks/useReadingsSelector";
import { useUpdateReadings } from "./useUpdateReadings";
import type { Exercise } from "@/types/exercises";

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 1,
  assignment_id: 10,
  question_id: 100,
  points: 5,
  timed: false,
  autograde: "all_or_nothing",
  which_to_grade: "best_answer",
  reading_assignment: true,
  sorting_priority: 0,
  activities_required: 1,
  use_llm: false,
  qnumber: "q1",
  name: "reading-1",
  subchapter: "sub1",
  chapter: "ch1",
  base_course: "course",
  htmlsrc: "<p>html</p>",
  question_type: "page",
  question_json: JSON.stringify({ statement: "text" }),
  owner: "owner",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Title",
  topic: "topic",
  difficulty: 1,
  author: "author",
  description: "",
  is_private: false,
  from_source: true,
  ...overrides
});

describe("useUpdateReadings", () => {
  let updateExercises: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateExercises = vi.fn().mockResolvedValue({ error: undefined });

    (useUpdateAssignmentQuestionsMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      updateExercises
    ]);
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns handleChange function", () => {
    const { result } = renderHook(() => useUpdateReadings());
    expect(typeof result.current.handleChange).toBe("function");
  });

  it("shows error toast when reading with given id is not found", async () => {
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: [makeExercise({ id: 2 })]
    });

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(999, "points", 10);
    });

    expect(notify.error).toHaveBeenCalledWith("This reading is no longer in the assignment");
    expect(updateExercises).not.toHaveBeenCalled();
  });

  it("does nothing when new value equals current value", async () => {
    const exercise = makeExercise({ id: 1, points: 5 });
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: [exercise]
    });

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(1, "points", 5);
    });

    expect(updateExercises).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("calls updateExercises with merged exercise when value changes", async () => {
    const exercise = makeExercise({ id: 1, points: 5 });
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: [exercise]
    });

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(1, "points", 10);
    });

    expect(updateExercises).toHaveBeenCalledOnce();
    const [calledWith] = updateExercises.mock.calls[0];
    expect(calledWith).toHaveLength(1);
    expect(calledWith[0]).toMatchObject({ id: 1, points: 10 });
  });

  it("serializes question_json to string when calling updateExercises", async () => {
    const parsedJson = { statement: "hello" };
    const exercise = makeExercise({
      id: 1,
      points: 3,
      question_json: parsedJson as unknown as string
    });
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: [exercise]
    });

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(1, "points", 7);
    });

    const [calledWith] = updateExercises.mock.calls[0];
    expect(calledWith[0].question_json).toBe(JSON.stringify(parsedJson));
  });

  it("shows success toast after successful update", async () => {
    updateExercises.mockResolvedValue({ error: undefined });
    const exercise = makeExercise({ id: 1, points: 3 });
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: [exercise]
    });

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(1, "points", 7);
    });

    expect(notify.success).toHaveBeenCalledWith("Reading updated");
  });

  it("shows error toast when updateExercises returns an error", async () => {
    updateExercises.mockResolvedValue({ error: new Error("network error") });
    const exercise = makeExercise({ id: 1, points: 3 });
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: [exercise]
    });

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(1, "points", 7);
    });

    expect(notify.error).toHaveBeenCalledWith("Couldn't update reading. Try again.");
  });

  it("updates autograde field correctly", async () => {
    const exercise = makeExercise({ id: 1, autograde: "all_or_nothing" });
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: [exercise]
    });

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(1, "autograde", "pct_correct");
    });

    const [calledWith] = updateExercises.mock.calls[0];
    expect(calledWith[0].autograde).toBe("pct_correct");
  });

  it("updates activities_required field correctly", async () => {
    const exercise = makeExercise({ id: 1, activities_required: 1 });
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: [exercise]
    });

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(1, "activities_required", 3);
    });

    const [calledWith] = updateExercises.mock.calls[0];
    expect(calledWith[0].activities_required).toBe(3);
  });

  it("handles empty readingExercises list by showing not found error", async () => {
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: []
    });

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(1, "points", 5);
    });

    expect(notify.error).toHaveBeenCalledWith("This reading is no longer in the assignment");
  });

  it("handles undefined readingExercises by showing not found error", async () => {
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({});

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(1, "points", 5);
    });

    expect(notify.error).toHaveBeenCalledWith("This reading is no longer in the assignment");
  });

  it("finds the correct reading among multiple exercises", async () => {
    const exercises = [makeExercise({ id: 1, points: 1 }), makeExercise({ id: 2, points: 2 })];
    (useReadingsSelector as ReturnType<typeof vi.fn>).mockReturnValue({
      readingExercises: exercises
    });

    const { result } = renderHook(() => useUpdateReadings());

    await act(async () => {
      await result.current.handleChange(2, "points", 9);
    });

    const [calledWith] = updateExercises.mock.calls[0];
    expect(calledWith[0].id).toBe(2);
    expect(calledWith[0].points).toBe(9);
  });
});
