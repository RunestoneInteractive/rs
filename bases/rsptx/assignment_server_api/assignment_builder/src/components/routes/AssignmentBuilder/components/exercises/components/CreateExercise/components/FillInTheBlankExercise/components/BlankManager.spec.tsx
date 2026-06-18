import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { BlankManager } from "./BlankManager";
import { GraderType, type BlankWithFeedback } from "../types";

vi.mock("@components/ui/Regex/RegexEditor", () => ({
  RegexEditor: () => <div data-testid="regex-editor" />
}));

vi.mock("../../../shared/styles/CreateExercise.module.css", () => ({ default: {} }));
vi.mock("./BlankManager.module.css", () => ({ default: {} }));

const makeBlank = (overrides: Partial<BlankWithFeedback> = {}): BlankWithFeedback => ({
  id: "blank-1",
  graderType: GraderType.STRING,
  exactMatch: "answer",
  correctFeedback: "Correct!",
  incorrectFeedback: "Try again",
  ...overrides
});

describe("BlankManager", () => {
  it("prompts to add {blank} placeholders when the question has none", () => {
    renderWithMantine(
      <BlankManager blanks={[]} onChange={vi.fn()} questionText="No blanks here" />
    );

    expect(screen.getByText(/Add .*placeholders/)).toBeInTheDocument();
  });

  it("renders an accordion control per blank when placeholders exist", () => {
    renderWithMantine(
      <BlankManager
        blanks={[makeBlank()]}
        onChange={vi.fn()}
        questionText="Fill in the {blank} here"
      />
    );

    expect(screen.getByText("Answer field 1")).toBeInTheDocument();
  });

  it("reveals the grader type select when a field is expanded", () => {
    renderWithMantine(
      <BlankManager
        blanks={[makeBlank()]}
        onChange={vi.fn()}
        questionText="Fill in the {blank} here"
      />
    );

    fireEvent.click(screen.getByText("Answer field 1"));

    expect(screen.getByText("Grader type")).toBeInTheDocument();
  });
});
