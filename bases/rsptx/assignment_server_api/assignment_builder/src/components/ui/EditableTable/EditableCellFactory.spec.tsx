import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithMantine } from "@/test/renderWithMantine";

import { EditableCellFactory } from "./EditableCellFactory";

vi.mock("@/hooks/useTableDropdownOptions", () => ({
  useTableDropdownOptions: () => ({
    autograde: [{ value: "pct_correct", label: "Percent correct" }],
    which_to_grade: [{ value: "best_answer", label: "Best answer" }]
  })
}));

const renderFactory = (
  overrides: Partial<React.ComponentProps<typeof EditableCellFactory>> = {}
) =>
  renderWithMantine(
    <EditableCellFactory
      fieldName="points"
      itemId={11}
      handleMouseDown={vi.fn()}
      handleChange={vi.fn()}
      value={5}
      questionType="mchoice"
      isDragging={false}
      {...overrides}
    />
  );

describe("EditableCellFactory", () => {
  it("labels a number cell with its field and row label and a row-unique id", () => {
    renderFactory({ rowLabel: "Question One" });

    const input = screen.getByRole("textbox", { name: "Points for Question One" });

    expect(input).toHaveAttribute("id", "points-11");
  });

  it("labels a dropdown cell with its field and row label and a row-unique id", () => {
    renderFactory({
      fieldName: "autograde",
      value: "pct_correct",
      rowLabel: "Question One"
    });

    const select = screen.getByRole("textbox", { name: "Autograde for Question One" });

    expect(select).toHaveAttribute("id", "autograde-11");
  });

  it("falls back to the row id when no row label is provided", () => {
    renderFactory();

    expect(screen.getByRole("textbox", { name: "Points for row 11" })).toBeInTheDocument();
  });

  it("keeps ids distinct across rows for the same field", () => {
    renderFactory({ itemId: 1 });
    renderFactory({ itemId: 2 });

    expect(document.getElementById("points-1")).not.toBeNull();
    expect(document.getElementById("points-2")).not.toBeNull();
  });
});
