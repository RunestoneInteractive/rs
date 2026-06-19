import { vi } from "vitest";

import { fireEvent, renderWithMantine, screen } from "@/test/renderWithMantine";

import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("renders default title, message and retry label", () => {
    renderWithMantine(<ErrorState />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh page/ })).toBeInTheDocument();
  });

  it("renders custom title and message", () => {
    renderWithMantine(<ErrorState title="Unable to load assignments" message="Custom message" />);

    expect(screen.getByRole("heading", { name: "Unable to load assignments" })).toBeInTheDocument();
    expect(screen.getByText("Custom message")).toBeInTheDocument();
  });

  it("calls onRetry with a custom retry label", () => {
    const onRetry = vi.fn();

    renderWithMantine(<ErrorState retryLabel="Try again" onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));

    expect(onRetry).toHaveBeenCalled();
  });

  it("reloads the page by default", () => {
    const reload = vi.fn();

    vi.stubGlobal("location", { ...window.location, reload });

    renderWithMantine(<ErrorState />);

    fireEvent.click(screen.getByRole("button", { name: /Refresh page/ }));

    expect(reload).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
