import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithMantine } from "@/test/renderWithMantine";

import { EditableCellProps } from "@/types/components/editableTableCell";

import { withCellRangeSelector } from "./WithCellRangeSelector";

const InnerCell = (props: EditableCellProps) => <span>cell {props.itemId}</span>;

const Wrapped = withCellRangeSelector(InnerCell);

const renderCell = (
  overrides: { isDragging?: boolean; handleMouseDown?: ReturnType<typeof vi.fn> } = {}
) =>
  renderWithMantine(
    <Wrapped
      fieldName="points"
      itemId={7}
      handleMouseDown={overrides.handleMouseDown ?? vi.fn()}
      handleChange={vi.fn()}
      value={3}
      questionType="mchoice"
      isDragging={overrides.isDragging ?? false}
    />
  );

describe("withCellRangeSelector", () => {
  it("reveals the drag-fill handle on hover as a mouse-only enhancement hidden from the accessibility tree", () => {
    const { container } = renderCell();

    expect(container.querySelector("[data-drag-fill-handle]")).toBeNull();

    fireEvent.mouseEnter(screen.getByText("cell 7").parentElement!);

    const handle = container.querySelector("[data-drag-fill-handle]");

    expect(handle).not.toBeNull();
    expect(handle).toHaveAttribute("aria-hidden", "true");
    expect(handle).not.toHaveAttribute("role");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("starts a range drag from the handle with the cell coordinates", () => {
    const handleMouseDown = vi.fn();
    const { container } = renderCell({ handleMouseDown });

    fireEvent.mouseEnter(screen.getByText("cell 7").parentElement!);
    fireEvent.mouseDown(container.querySelector("[data-drag-fill-handle]")!);

    expect(handleMouseDown).toHaveBeenCalledWith(7, "points");
  });

  it("hides the handle while a drag is already in progress", () => {
    const { container } = renderCell({ isDragging: true });

    fireEvent.mouseEnter(screen.getByText("cell 7").parentElement!);

    expect(container.querySelector("[data-drag-fill-handle]")).toBeNull();
  });
});
