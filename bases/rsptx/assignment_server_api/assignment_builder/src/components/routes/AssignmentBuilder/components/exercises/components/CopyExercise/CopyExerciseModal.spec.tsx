import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { Exercise } from "@/types/exercises";

import { COPY_EXERCISE_TOAST_COPY, CopyExerciseModal } from "./CopyExerciseModal";

const { mockValidate, mockCopy, mockRefetch } = vi.hoisted(() => ({
  mockValidate: vi.fn(),
  mockCopy: vi.fn(),
  mockRefetch: vi.fn()
}));

vi.mock("@store/assignmentExercise/assignmentExercise.logic.api", () => ({
  useValidateQuestionNameMutation: () => [mockValidate],
  useCopyQuestionMutation: () => [mockCopy, { isLoading: false }],
  useGetExercisesQuery: () => ({ refetch: mockRefetch })
}));

vi.mock("@/hooks/useSelectedAssignment", () => ({
  useSelectedAssignment: () => ({ selectedAssignment: { id: 1 } })
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

const editableExercise = {
  id: 5,
  question_id: 5,
  name: "Original",
  question_type: "mchoice",
  question_json: { foo: "bar" }
} as unknown as Exercise;

const nonEditableExercise = {
  id: 6,
  question_id: 6,
  name: "Original",
  question_type: "unsupported",
  question_json: undefined
} as unknown as Exercise;

describe("CopyExerciseModal", () => {
  beforeEach(() => {
    mockValidate.mockReset();
    mockCopy.mockReset();
    mockRefetch.mockReset();
  });

  it("shows the ownership info alert and pre-fills the exercise name", () => {
    renderWithMantine(
      <CopyExerciseModal
        visible
        onHide={vi.fn()}
        exercise={editableExercise}
        setCurrentEditExercise={vi.fn()}
        setViewMode={vi.fn()}
      />
    );

    expect(
      screen.getByText(/The copy will be added to your current assignment/)
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Original")).toBeInTheDocument();
  });

  it("shows the editor-support alert when the type supports direct editing", () => {
    renderWithMantine(
      <CopyExerciseModal
        visible
        onHide={vi.fn()}
        exercise={editableExercise}
        setCurrentEditExercise={vi.fn()}
        setViewMode={vi.fn()}
      />
    );

    expect(
      screen.getByText(/The copy will open in the editor immediately after it is created/)
    ).toBeInTheDocument();
  });

  it("shows the unsupported-type warning when the type cannot be edited visually", () => {
    renderWithMantine(
      <CopyExerciseModal visible onHide={vi.fn()} exercise={nonEditableExercise} />
    );

    expect(screen.getByText(/This exercise type doesn't have a visual editor/)).toBeInTheDocument();
  });

  it("calls onHide when Cancel is clicked", async () => {
    const onHide = vi.fn();

    renderWithMantine(<CopyExerciseModal visible onHide={onHide} exercise={editableExercise} />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("uses sentence-case copy for the title, name label, and primary buttons", () => {
    renderWithMantine(
      <CopyExerciseModal
        visible
        onHide={vi.fn()}
        exercise={editableExercise}
        setCurrentEditExercise={vi.fn()}
        setViewMode={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: "Copy exercise" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name for the copy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy, add, and edit" })).toBeInTheDocument();
  });

  it("offers the add-only button when the type has no visual editor", () => {
    renderWithMantine(
      <CopyExerciseModal visible onHide={vi.fn()} exercise={nonEditableExercise} />
    );

    expect(screen.getByRole("button", { name: "Copy and add to assignment" })).toBeInTheDocument();
  });

  it("keeps the toast copy on the canonical shapes", () => {
    expect(COPY_EXERCISE_TOAST_COPY.copied).toBe("Copy added to this assignment. You own it now.");
    expect(COPY_EXERCISE_TOAST_COPY.copiedAndEditing).toBe(
      "Copy added to this assignment. Opening editor…"
    );
    expect(COPY_EXERCISE_TOAST_COPY.copyError).toBe("Couldn't copy exercise. Try again.");
  });
});
