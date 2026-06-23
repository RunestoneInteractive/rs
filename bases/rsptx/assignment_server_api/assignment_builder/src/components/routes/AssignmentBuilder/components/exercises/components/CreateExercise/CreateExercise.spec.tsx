import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { CreateExercise } from "./CreateExercise";

let routedType: string | null = null;
const updateExerciseType = vi.fn();
const updateExerciseViewMode = vi.fn();

vi.mock("@components/routes/AssignmentBuilder/hooks/useAssignmentRouting", () => ({
  useAssignmentRouting: () => ({
    exerciseType: routedType,
    updateExerciseType,
    updateExerciseViewMode
  })
}));

vi.mock("react-redux", () => ({
  useSelector: () => [{ value: "python", label: "Python" }]
}));

vi.mock("./components/ExerciseFactory", () => ({
  ExerciseFactory: ({
    type,
    initialData
  }: {
    type: string;
    initialData?: { statement?: string };
  }) => (
    <div data-testid="factory">
      {type}
      <span data-testid="factory-statement">{initialData?.statement ?? ""}</span>
    </div>
  )
}));

vi.mock("./components/ExerciseTypeSelect", () => ({
  ExerciseTypeSelect: ({ onSelect }: { onSelect: (type: string) => void }) => (
    <button type="button" onClick={() => onSelect("mchoice")}>
      pick-mchoice
    </button>
  )
}));

vi.mock("./components/ImportQuestionJsonModal", () => ({
  ImportQuestionJsonModal: ({
    opened,
    onApply
  }: {
    opened: boolean;
    onApply: (type: string, data: { statement: string }) => void;
  }) =>
    opened ? (
      <button type="button" onClick={() => onApply("mchoice", { statement: "from-json" })}>
        apply-import
      </button>
    ) : null
}));

beforeEach(() => {
  routedType = null;
  updateExerciseType.mockClear();
  updateExerciseViewMode.mockClear();
});

describe("CreateExercise", () => {
  it("shows the type-selection view when no type is selected", () => {
    renderWithMantine(<CreateExercise onCancel={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText("Select exercise type")).toBeInTheDocument();
  });

  it("shows the edit title in edit mode without a type", () => {
    renderWithMantine(<CreateExercise onCancel={vi.fn()} onSave={vi.fn()} isEdit />);

    expect(screen.getByText("Edit exercise type")).toBeInTheDocument();
  });

  it("calls onCancel from the Cancel button in the type-selection view", () => {
    const onCancel = vi.fn();

    renderWithMantine(<CreateExercise onCancel={onCancel} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });

  it("selecting a type renders the exercise factory and updates routing", () => {
    renderWithMantine(<CreateExercise onCancel={vi.fn()} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "pick-mchoice" }));

    expect(updateExerciseType).toHaveBeenCalledWith("mchoice");
    expect(screen.getByTestId("factory")).toHaveTextContent("mchoice");
  });

  it("renders the factory directly when a type is already routed", () => {
    routedType = "activecode";

    renderWithMantine(<CreateExercise onCancel={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByTestId("factory")).toHaveTextContent("activecode");
  });

  it("shows the Paste JSON button on the type-selection view", () => {
    renderWithMantine(<CreateExercise onCancel={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Paste JSON" })).toBeInTheDocument();
  });

  it("importing JSON renders the factory pre-filled with the chosen type", () => {
    renderWithMantine(<CreateExercise onCancel={vi.fn()} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Paste JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "apply-import" }));

    expect(updateExerciseType).toHaveBeenCalledWith("mchoice");
    expect(screen.getByTestId("factory")).toHaveTextContent("mchoice");
    expect(screen.getByTestId("factory-statement")).toHaveTextContent("from-json");
  });

  it("offers a View / Replace JSON button in edit mode", () => {
    renderWithMantine(
      <CreateExercise
        onCancel={vi.fn()}
        onSave={vi.fn()}
        isEdit
        initialData={{ question_type: "mchoice" }}
      />
    );

    expect(screen.getByRole("button", { name: "View / Replace JSON" })).toBeInTheDocument();
  });
});
