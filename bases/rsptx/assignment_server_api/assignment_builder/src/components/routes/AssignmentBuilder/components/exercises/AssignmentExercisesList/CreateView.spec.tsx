import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";
import { CreateExerciseFormType } from "@/types/exercises";
import { notify } from "@components/ui/notify";

import { CreateView } from "./CreateView";

const createTrigger = vi.fn();

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

vi.mock("react-redux", () => ({
  useSelector: () => 42
}));

vi.mock("@store/assignment/assignment.logic", () => ({
  assignmentSelectors: { getSelectedAssignmentId: vi.fn() }
}));

vi.mock("@store/exercises/exercises.logic.api", () => ({
  useCreateNewExerciseMutation: () => [createTrigger]
}));

vi.mock("@/utils/questionJson", () => ({
  buildQuestionJson: () => "{}"
}));

let lastSaveResult: Promise<void> | undefined;

vi.mock("../components/CreateExercise/CreateExercise", () => ({
  CreateExercise: ({
    onSave
  }: {
    onSave: (data: Partial<CreateExerciseFormType>) => Promise<void>;
  }) => (
    <button
      onClick={() => {
        lastSaveResult = onSave({
          name: "ex1",
          chapter: "ch1",
          question_type: "mchoice",
          points: 1,
          difficulty: 3
        });
        lastSaveResult.catch(() => undefined);
      }}
    >
      trigger save
    </button>
  )
}));

const baseProps = {
  setViewMode: vi.fn(),
  resetExerciseForm: false,
  setResetExerciseForm: vi.fn(),
  setShowSuccessDialog: vi.fn(),
  setLastExerciseType: vi.fn(),
  setIsSaving: vi.fn()
};

beforeEach(() => {
  vi.clearAllMocks();
  lastSaveResult = undefined;
});

describe("CreateView", () => {
  it("shows the success dialog after the create mutation resolves", async () => {
    createTrigger.mockReturnValue({ unwrap: () => Promise.resolve(7) });
    const setShowSuccessDialog = vi.fn();
    const setLastExerciseType = vi.fn();

    renderWithMantine(
      <CreateView
        {...baseProps}
        setShowSuccessDialog={setShowSuccessDialog}
        setLastExerciseType={setLastExerciseType}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "trigger save" }));
    await lastSaveResult;

    expect(setLastExerciseType).toHaveBeenCalledWith("mchoice");
    expect(setShowSuccessDialog).toHaveBeenCalledWith(true);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it("propagates a failed create so the editor resets its saving state", async () => {
    createTrigger.mockReturnValue({ unwrap: () => Promise.reject(new Error("500")) });
    const setShowSuccessDialog = vi.fn();

    renderWithMantine(<CreateView {...baseProps} setShowSuccessDialog={setShowSuccessDialog} />);

    await userEvent.click(screen.getByRole("button", { name: "trigger save" }));

    await expect(lastSaveResult).rejects.toThrow("500");
    expect(setShowSuccessDialog).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });
});
