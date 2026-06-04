import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";
import { CreateExerciseFormType, Exercise } from "@/types/exercises";
import { notify } from "@components/ui/notify";

import { EditView } from "./EditView";

const updateTrigger = vi.fn();

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
  useSelector: () => []
}));

vi.mock("@store/dataset/dataset.logic", () => ({
  datasetSelectors: { getLanguageOptions: vi.fn() }
}));

vi.mock("@store/assignmentExercise/assignmentExercise.logic.api", () => ({
  useUpdateAssignmentQuestionsMutation: () => [updateTrigger]
}));

vi.mock("@/utils/questionJson", () => ({
  buildQuestionJson: () => "{}",
  mergeQuestionJsonWithDefaults: () => ({})
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
        lastSaveResult = onSave({ name: "ex1", question_type: "mchoice" });
        lastSaveResult.catch(() => undefined);
      }}
    >
      trigger save
    </button>
  )
}));

const exercise = { id: 1, question_json: "{}" } as unknown as Exercise;

const baseProps = {
  currentEditExercise: exercise,
  setCurrentEditExercise: vi.fn(),
  setViewMode: vi.fn()
};

beforeEach(() => {
  vi.clearAllMocks();
  lastSaveResult = undefined;
});

describe("EditView", () => {
  it("toasts Exercise updated and returns to the list after the update resolves", async () => {
    updateTrigger.mockReturnValue({ unwrap: () => Promise.resolve() });
    const setViewMode = vi.fn();
    const setCurrentEditExercise = vi.fn();
    const refetch = vi.fn();

    renderWithMantine(
      <EditView
        {...baseProps}
        setViewMode={setViewMode}
        setCurrentEditExercise={setCurrentEditExercise}
        refetch={refetch}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "trigger save" }));
    await lastSaveResult;

    expect(notify.success).toHaveBeenCalledWith("Exercise updated");
    expect(setViewMode).toHaveBeenCalledWith("list");
    expect(setCurrentEditExercise).toHaveBeenCalledWith(null);
    expect(refetch).toHaveBeenCalled();
  });

  it("propagates a failed update without a success toast or navigation", async () => {
    updateTrigger.mockReturnValue({ unwrap: () => Promise.reject(new Error("500")) });
    const setViewMode = vi.fn();

    renderWithMantine(<EditView {...baseProps} setViewMode={setViewMode} />);

    await userEvent.click(screen.getByRole("button", { name: "trigger save" }));

    await expect(lastSaveResult).rejects.toThrow("500");
    expect(notify.success).not.toHaveBeenCalled();
    expect(setViewMode).not.toHaveBeenCalled();
  });
});
