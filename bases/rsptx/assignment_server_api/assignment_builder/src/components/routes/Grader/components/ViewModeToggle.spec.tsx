import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ViewModeToggle } from "./ViewModeToggle";

describe("ViewModeToggle", () => {
  it("moves between view options with arrow keys", async () => {
    const onChange = vi.fn();

    renderWithMantine(<ViewModeToggle value="cards" onChange={onChange} />);

    screen.getByRole("radio", { name: /cards/i }).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("table");
  });
});
