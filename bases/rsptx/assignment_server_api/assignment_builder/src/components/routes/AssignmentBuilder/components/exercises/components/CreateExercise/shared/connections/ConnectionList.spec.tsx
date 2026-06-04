import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { ConnectionList } from "./ConnectionList";

const resolveLabel = (id: string) => (id === "l1" ? "Apple" : "Red fruit");

describe("ConnectionList", () => {
  it("shows the empty state with the count at zero", () => {
    renderWithMantine(
      <ConnectionList connections={[]} resolveLabel={resolveLabel} onRemove={vi.fn()} />
    );

    expect(screen.getByText("Connections (0)")).toBeInTheDocument();
    expect(screen.getByText(/No connections yet/)).toBeInTheDocument();
  });

  it("renders each connection as a focusable row with both labels", () => {
    renderWithMantine(
      <ConnectionList connections={[["l1", "r1"]]} resolveLabel={resolveLabel} onRemove={vi.fn()} />
    );

    const row = screen.getByRole("listitem");

    expect(row).toHaveAttribute("tabindex", "0");
    expect(row).toHaveTextContent("Apple");
    expect(row).toHaveTextContent("Red fruit");
    expect(screen.getByText("Connections (1)")).toBeInTheDocument();
  });

  it("removes a connection through the labeled delete button", () => {
    const onRemove = vi.fn();

    renderWithMantine(
      <ConnectionList
        connections={[["l1", "r1"]]}
        resolveLabel={resolveLabel}
        onRemove={onRemove}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remove connection from Apple to Red fruit" })
    );

    expect(onRemove).toHaveBeenCalledWith("l1", "r1");
  });
});
