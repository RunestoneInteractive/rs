import { render, screen } from "@testing-library/react";

import { Toolbar } from "../Toolbar";

describe("Toolbar", () => {
  it("renders the start and end sections in order", () => {
    render(<Toolbar start={<span>Filters</span>} end={<button type="button">Export</button>} />);

    const filters = screen.getByText("Filters");
    const exportButton = screen.getByRole("button", { name: "Export" });

    expect(
      filters.compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("omits sections that were not provided", () => {
    const { container } = render(<Toolbar start={<span>Filters</span>} />);

    expect(container.firstElementChild?.childElementCount).toBe(1);
  });

  it("forwards div attributes and custom classes", () => {
    render(<Toolbar start="Filters" className="page-toolbar" aria-label="Student filters" />);

    expect(screen.getByLabelText("Student filters")).toHaveClass("page-toolbar");
  });
});
