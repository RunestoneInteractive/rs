import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ExerciseLayout } from "./ExerciseLayout";

vi.mock("@/hooks/useFullscreen", () => ({
  useFullscreen: () => ({
    isFullscreen: false,
    toggleFullscreen: vi.fn(),
    exitFullscreen: vi.fn(),
    isSupported: false
  })
}));

vi.mock("../config/stepConfigs", () => ({
  getStepConfig: () => null
}));

vi.mock("@/components/ui/ExerciseTypeTag", () => ({
  ExerciseTypeTag: ({ type }: { type: string }) => <span data-testid="type-tag">{type}</span>
}));

const steps = [{ label: "First" }, { label: "Second" }, { label: "Third" }];

const baseProps = {
  title: "Active Code",
  exerciseType: "activecode",
  isEdit: false,
  steps,
  isCurrentStepValid: () => true,
  isSaving: false,
  stepsValidity: {},
  onCancel: vi.fn(),
  onBack: vi.fn(),
  onNext: vi.fn(),
  onSave: vi.fn(),
  onStepSelect: vi.fn()
};

describe("ExerciseLayout", () => {
  it("shows the create title and a Next button on a non-final step", () => {
    renderWithMantine(
      <ExerciseLayout {...baseProps} activeStep={0}>
        <div>content</div>
      </ExerciseLayout>
    );

    expect(screen.getByRole("heading", { name: "Create Active Code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Back$/i })).not.toBeInTheDocument();
  });

  it("renders the exercise type tag beside the title", () => {
    renderWithMantine(
      <ExerciseLayout {...baseProps} activeStep={0}>
        <div>content</div>
      </ExerciseLayout>
    );

    expect(screen.getByTestId("type-tag")).toHaveTextContent("activecode");
  });

  it("shows the Save button on the final step and edit title", async () => {
    const onSave = vi.fn();

    renderWithMantine(
      <ExerciseLayout {...baseProps} isEdit activeStep={2} onSave={onSave}>
        <div>content</div>
      </ExerciseLayout>
    );

    expect(screen.getByRole("heading", { name: "Edit Active Code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Save/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("disables Next and lists the failing fields after a failed attempt", () => {
    renderWithMantine(
      <ExerciseLayout
        {...baseProps}
        activeStep={0}
        validation={{
          isValid: false,
          errors: ["Exercise name is required", "Points must be greater than 0"]
        }}
      >
        <div>content</div>
      </ExerciseLayout>
    );

    expect(screen.getByRole("button", { name: /Next/i })).toBeDisabled();

    const alertBar = screen.getByRole("alert");

    expect(alertBar).toHaveTextContent("Exercise name is required");
    expect(alertBar).toHaveTextContent("Points must be greater than 0");
  });

  it("keeps Next enabled and shows no validation bar before an attempt", () => {
    renderWithMantine(
      <ExerciseLayout {...baseProps} activeStep={0}>
        <div>content</div>
      </ExerciseLayout>
    );

    expect(screen.getByRole("button", { name: /Next/i })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables Save on the final step while validation fails", () => {
    renderWithMantine(
      <ExerciseLayout
        {...baseProps}
        activeStep={2}
        validation={{ isValid: false, errors: ["Chapter is required"] }}
      >
        <div>content</div>
      </ExerciseLayout>
    );

    expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
  });

  it("cancels immediately when the form is not dirty", async () => {
    const onCancel = vi.fn();

    renderWithMantine(
      <ExerciseLayout {...baseProps} activeStep={0} onCancel={onCancel}>
        <div>content</div>
      </ExerciseLayout>
    );

    await userEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
  });

  it("asks for confirmation before discarding a dirty form", async () => {
    const onCancel = vi.fn();

    renderWithMantine(
      <ExerciseLayout {...baseProps} activeStep={0} isDirty onCancel={onCancel}>
        <div>content</div>
      </ExerciseLayout>
    );

    await userEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(
      screen.getByText("Your unsaved changes to this exercise will be lost.")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps editing when the discard confirm is dismissed", async () => {
    const onCancel = vi.fn();

    renderWithMantine(
      <ExerciseLayout {...baseProps} activeStep={0} isDirty onCancel={onCancel}>
        <div>content</div>
      </ExerciseLayout>
    );

    await userEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Keep editing" }));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("keeps the step badges on a single row instead of wrapping", () => {
    const { container } = renderWithMantine(
      <ExerciseLayout {...baseProps} activeStep={0}>
        <div>content</div>
      </ExerciseLayout>
    );

    const stepsRow = container.querySelector(".mantine-Stepper-steps");

    expect(stepsRow).not.toBeNull();
    expect(stepsRow).not.toHaveAttribute("data-wrap");
  });

  it("selects a step when its stepper button is clicked", async () => {
    const onStepSelect = vi.fn();

    renderWithMantine(
      <ExerciseLayout {...baseProps} activeStep={0} onStepSelect={onStepSelect}>
        <div>content</div>
      </ExerciseLayout>
    );

    await userEvent.click(screen.getByRole("button", { name: /Second/i }));
    expect(onStepSelect).toHaveBeenCalledWith(1);
  });

  it("keeps each step's accessible name when the visual label is hidden at narrow widths", () => {
    renderWithMantine(
      <ExerciseLayout {...baseProps} activeStep={0}>
        <div>content</div>
      </ExerciseLayout>
    );

    for (const step of steps) {
      expect(screen.getByRole("button", { name: step.label })).toHaveAttribute(
        "aria-label",
        step.label
      );
    }
  });
});
