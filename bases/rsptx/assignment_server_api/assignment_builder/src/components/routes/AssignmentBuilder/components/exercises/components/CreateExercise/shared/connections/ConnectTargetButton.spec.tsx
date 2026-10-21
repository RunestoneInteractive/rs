import { fireEvent, screen } from "@testing-library/react";

import { renderWithMantine } from "@/test/renderWithMantine";

import { ConnectTargetButton } from "./ConnectTargetButton";

describe("ConnectTargetButton", () => {
  it("renders a button with the aria-label", () => {
    renderWithMantine(
      <ConnectTargetButton
        blockId="r1"
        ariaLabel="Connect to target match 1"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Connect to target match 1" })).toBeInTheDocument();
  });

  it("completes the connection on click without bubbling to the block", () => {
    const onComplete = vi.fn();
    const onBlockClick = vi.fn();

    renderWithMantine(
      <ConnectTargetButton
        blockId="r1"
        ariaLabel="Connect to target match 1"
        onComplete={onComplete}
      />
    );

    document.body.addEventListener("click", onBlockClick);
    fireEvent.click(screen.getByRole("button", { name: "Connect to target match 1" }));
    document.body.removeEventListener("click", onBlockClick);

    expect(onComplete).toHaveBeenCalledWith("r1");
    expect(onBlockClick).not.toHaveBeenCalled();
  });
});
