import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { StdinEditor } from "./StdinEditor";

describe("StdinEditor", () => {
  it("renders the textarea with the provided value and a hint", () => {
    renderWithMantine(<StdinEditor stdin="line one" onChange={vi.fn()} />);

    expect(screen.getByRole("textbox")).toHaveValue("line one");
    expect(screen.getByText(/available as a line of input/i)).toBeInTheDocument();
  });

  it("forwards typed input through onChange", async () => {
    const onChange = vi.fn();

    renderWithMantine(<StdinEditor stdin="" onChange={onChange} />);

    await userEvent.type(screen.getByRole("textbox"), "x");
    expect(onChange).toHaveBeenCalledWith("x");
  });
});
