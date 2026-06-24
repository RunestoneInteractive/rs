import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { SaveStatusPill } from "./SaveStatusPill";

describe("SaveStatusPill", () => {
  it("renders nothing when status is idle", () => {
    renderWithMantine(<SaveStatusPill status="idle" />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows 'Unsaved' for the dirty status", () => {
    renderWithMantine(<SaveStatusPill status="dirty" />);

    expect(screen.getByRole("status")).toHaveTextContent("Unsaved");
  });

  it("shows 'Saving…' for the saving status", () => {
    renderWithMantine(<SaveStatusPill status="saving" />);

    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
  });

  it("shows 'Saved' with the draw-in checkmark for the saved status", () => {
    renderWithMantine(<SaveStatusPill status="saved" />);

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByTestId("save-pill-checkmark")).toBeInTheDocument();
  });

  it("shows 'Save failed' with a Retry button that calls onRetry", async () => {
    const onRetry = vi.fn();

    renderWithMantine(
      <SaveStatusPill status="error" onRetry={onRetry} errorMessage="Network down" />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Save failed");
    expect(screen.getByRole("status")).toHaveAttribute("title", "Network down");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render the checkmark outside the saved status", () => {
    renderWithMantine(<SaveStatusPill status="dirty" />);

    expect(screen.queryByTestId("save-pill-checkmark")).not.toBeInTheDocument();
  });
});
