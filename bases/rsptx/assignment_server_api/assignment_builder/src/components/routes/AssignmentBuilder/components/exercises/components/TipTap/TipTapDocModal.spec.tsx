import { act, renderHook } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithMantine } from "@/test/renderWithMantine";

import { TipTapDocModal, useTipTapDocModal } from "./TipTapDocModal";

describe("TipTapDocModal", () => {
  it("renders the guide content when visible", () => {
    renderWithMantine(<TipTapDocModal visible onHide={vi.fn()} />);
    expect(screen.getByText("Editor guide")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Slash commands" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bubble menu" })).toBeInTheDocument();
  });

  it("documents Tab and Shift+Tab behavior", () => {
    renderWithMantine(<TipTapDocModal visible onHide={vi.fn()} />);
    expect(screen.getByText("Indent a list item; insert a tab in code blocks")).toBeInTheDocument();
    expect(screen.getByText("Outdent a list item")).toBeInTheDocument();
    expect(
      screen.getByText("Outside lists and code blocks, Tab moves focus to the next control.")
    ).toBeInTheDocument();
  });

  it("does not pair feature names with tautological descriptions", () => {
    renderWithMantine(<TipTapDocModal visible onHide={vi.fn()} />);
    expect(screen.queryByText(/Make text bold/)).not.toBeInTheDocument();
    expect(screen.queryByText("Rich Text Editor Guide")).not.toBeInTheDocument();
  });

  it("does not render the guide content when hidden", () => {
    renderWithMantine(<TipTapDocModal visible={false} onHide={vi.fn()} />);
    expect(screen.queryByText("Editor guide")).not.toBeInTheDocument();
  });

  it("calls onHide when the modal is closed", () => {
    const onHide = vi.fn();
    renderWithMantine(<TipTapDocModal visible onHide={onHide} />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onHide).toHaveBeenCalledTimes(1);
  });
});

describe("useTipTapDocModal", () => {
  it("toggles visibility through show and hide", () => {
    const { result } = renderHook(() => useTipTapDocModal());

    expect(result.current.visible).toBe(false);

    act(() => result.current.showModal());
    expect(result.current.visible).toBe(true);

    act(() => result.current.hideModal());
    expect(result.current.visible).toBe(false);
  });
});
