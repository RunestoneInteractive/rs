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

vi.mock("./components/ExerciseFactory", () => ({
  ExerciseFactory: ({ type }: { type: string }) => <div data-testid="factory">{type}</div>
}));

vi.mock("./components/ExerciseTypeSelect", () => ({
  ExerciseTypeSelect: ({ onSelect }: { onSelect: (type: string) => void }) => (
    <button type="button" onClick={() => onSelect("mchoice")}>
      pick-mchoice
    </button>
  )
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
});
