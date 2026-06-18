import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { ExerciseTypeSelect } from "./ExerciseTypeSelect";

const mockTypes = [
  { value: "activecode", label: "Active Code", description: "Write and run code" },
  { value: "mchoice", label: "Multiple Choice", description: "Pick an answer" },
  { value: "nodesc", label: "No Description", description: "" }
];

vi.mock("@/hooks/useExerciseTypes", () => ({
  useExerciseTypes: () => mockTypes
}));

describe("ExerciseTypeSelect", () => {
  it("renders a card for each type with a description", () => {
    renderWithMantine(<ExerciseTypeSelect selectedType={null} onSelect={vi.fn()} />);

    expect(screen.getByText("Active Code")).toBeInTheDocument();
    expect(screen.getByText("Multiple Choice")).toBeInTheDocument();
  });

  it("omits types without a description", () => {
    renderWithMantine(<ExerciseTypeSelect selectedType={null} onSelect={vi.fn()} />);

    expect(screen.queryByText("No Description")).not.toBeInTheDocument();
  });

  it("groups cards under their family labels", () => {
    const { container } = renderWithMantine(
      <ExerciseTypeSelect selectedType={null} onSelect={vi.fn()} />
    );

    expect(screen.getByText("Choice")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();

    const codeGroup = container.querySelector('[data-family="code"]');

    expect(codeGroup).toHaveTextContent("Active Code");
    expect(codeGroup).not.toHaveTextContent("Multiple Choice");
  });

  it("calls onSelect with the type value when a card is clicked", () => {
    const onSelect = vi.fn();

    renderWithMantine(<ExerciseTypeSelect selectedType={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("Active Code"));

    expect(onSelect).toHaveBeenCalledWith("activecode");
  });

  it("marks the selected card pressed with a check badge", () => {
    const { container } = renderWithMantine(
      <ExerciseTypeSelect selectedType="mchoice" onSelect={vi.fn()} />
    );

    const selected = screen.getByRole("button", { pressed: true });

    expect(selected).toHaveTextContent("Multiple Choice");
    expect(selected).toHaveAttribute("data-selected");
    expect(selected.querySelector("[data-check-badge]")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-check-badge]")).toHaveLength(1);
  });
});
