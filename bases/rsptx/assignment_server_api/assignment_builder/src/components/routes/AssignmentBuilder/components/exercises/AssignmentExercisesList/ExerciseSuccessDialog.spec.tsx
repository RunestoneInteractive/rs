import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ExerciseSuccessDialog } from "./ExerciseSuccessDialog";

const baseProps = {
  showSuccessDialog: true,
  setShowSuccessDialog: vi.fn(),
  handleCreateAnother: vi.fn(),
  handleFinishCreating: vi.fn(),
  lastExerciseType: "Multiple Choice"
};

describe("ExerciseSuccessDialog", () => {
  it("renders the saved-exercise message with the exercise type", () => {
    renderWithMantine(<ExerciseSuccessDialog {...baseProps} />);
    expect(screen.getByText("Exercise saved")).toBeInTheDocument();
    expect(screen.getByText(/Your Multiple Choice exercise is saved\./)).toBeInTheDocument();
  });

  it("invokes handleCreateAnother when 'Create another' is clicked", async () => {
    const handleCreateAnother = vi.fn();

    renderWithMantine(
      <ExerciseSuccessDialog {...baseProps} handleCreateAnother={handleCreateAnother} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Create another" }));
    expect(handleCreateAnother).toHaveBeenCalledTimes(1);
  });

  it("invokes handleFinishCreating when 'Back to exercises' is clicked", async () => {
    const handleFinishCreating = vi.fn();

    renderWithMantine(
      <ExerciseSuccessDialog {...baseProps} handleFinishCreating={handleFinishCreating} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Back to exercises" }));
    expect(handleFinishCreating).toHaveBeenCalledTimes(1);
  });
});
