import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ExerciseStepWrapper } from "./ExerciseStepWrapper";

describe("ExerciseStepWrapper", () => {
  it("renders the step title and its children", () => {
    renderWithMantine(
      <ExerciseStepWrapper title="Standard input" description="Helpful hint">
        <p>Step body</p>
      </ExerciseStepWrapper>
    );

    expect(screen.getByRole("heading", { name: "Standard input" })).toBeInTheDocument();
    expect(screen.getByText("Step body")).toBeInTheDocument();
  });

  it("exposes the step description on a focusable info trigger", async () => {
    renderWithMantine(
      <ExerciseStepWrapper title="Standard input" description="Helpful hint">
        <p>Step body</p>
      </ExerciseStepWrapper>
    );

    const trigger = screen.getByRole("button", { name: "About this step" });

    await userEvent.tab();
    expect(trigger).toHaveFocus();

    await userEvent.hover(trigger);
    expect(await screen.findByText("Helpful hint")).toBeInTheDocument();
  });
});
