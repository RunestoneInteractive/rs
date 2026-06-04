import { render, screen } from "@testing-library/react";

import { ValidationMessage } from "./ValidationMessage";

describe("ValidationMessage", () => {
  it("renders nothing when there are no errors", () => {
    const { container } = render(<ValidationMessage errors={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders an alert bar listing every error", () => {
    render(<ValidationMessage errors={["First problem", "Second problem"]} />);

    const bar = screen.getByRole("alert");
    const items = screen.getAllByRole("listitem");

    expect(bar).toBeInTheDocument();
    expect(items.map((item) => item.textContent)).toEqual(["First problem", "Second problem"]);
  });
});
