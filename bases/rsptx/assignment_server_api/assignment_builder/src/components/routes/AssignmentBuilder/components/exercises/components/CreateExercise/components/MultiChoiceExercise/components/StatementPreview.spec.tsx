import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { StatementPreview } from "./StatementPreview";

describe("StatementPreview", () => {
  it("toggles the preview body when the eye button is clicked", async () => {
    renderWithMantine(<StatementPreview statement="<p>Hello</p>" />);

    expect(screen.queryByText("Hello")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show preview" }));
    expect(screen.getByText("Hello")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hide preview" }));
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });
});
