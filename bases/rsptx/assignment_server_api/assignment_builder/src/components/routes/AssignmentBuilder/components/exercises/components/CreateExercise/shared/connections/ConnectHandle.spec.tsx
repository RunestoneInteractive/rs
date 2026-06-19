import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { ConnectHandle } from "./ConnectHandle";

const baseProps = {
  blockId: "left-1",
  ariaLabel: "Connect source item 1 to a target match",
  isActive: false,
  isConnected: false,
  direction: "right" as const,
  onStart: vi.fn(),
  onCancel: vi.fn()
};

describe("ConnectHandle", () => {
  it("renders a button with the aria-label and aria-pressed state", () => {
    renderWithMantine(<ConnectHandle {...baseProps} />);

    const button = screen.getByRole("button", {
      name: "Connect source item 1 to a target match"
    });

    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("reflects connect mode through aria-pressed", () => {
    renderWithMantine(<ConnectHandle {...baseProps} isActive={true} />);

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("starts the pointer connection on mouse down", () => {
    const onStart = vi.fn();

    renderWithMantine(<ConnectHandle {...baseProps} onStart={onStart} />);

    fireEvent.mouseDown(screen.getByRole("button"));

    expect(onStart).toHaveBeenCalledWith("left-1");
  });

  it("arms connect mode on a keyboard click", () => {
    const onStart = vi.fn();

    renderWithMantine(<ConnectHandle {...baseProps} onStart={onStart} />);

    fireEvent.click(screen.getByRole("button"), { detail: 0 });

    expect(onStart).toHaveBeenCalledWith("left-1");
  });

  it("cancels connect mode on a keyboard click while active", () => {
    const onStart = vi.fn();
    const onCancel = vi.fn();

    renderWithMantine(
      <ConnectHandle {...baseProps} isActive={true} onStart={onStart} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByRole("button"), { detail: 0 });

    expect(onCancel).toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("cancels connect mode on Escape even when the tooltip swallows the event", () => {
    const onCancel = vi.fn();

    renderWithMantine(<ConnectHandle {...baseProps} isActive={true} onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByRole("button"), { key: "Escape" });

    expect(onCancel).toHaveBeenCalled();
  });

  it("ignores mouse clicks so the pointer drag contract stays mouse-down driven", () => {
    const onStart = vi.fn();
    const onCancel = vi.fn();

    renderWithMantine(<ConnectHandle {...baseProps} onStart={onStart} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button"), { detail: 1 });

    expect(onStart).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
