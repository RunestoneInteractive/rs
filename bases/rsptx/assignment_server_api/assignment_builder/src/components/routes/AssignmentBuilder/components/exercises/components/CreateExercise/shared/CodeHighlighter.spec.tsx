import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { CodeHighlighter } from "./CodeHighlighter";

vi.mock("@monaco-editor/react", () => ({
  Editor: ({
    value,
    onChange
  }: {
    value: string;
    onChange?: (value: string | undefined) => void;
  }) => <textarea data-testid="monaco" value={value} onChange={(e) => onChange?.(e.target.value)} />
}));

describe("CodeHighlighter", () => {
  it("renders the editor with the current code", () => {
    renderWithMantine(<CodeHighlighter code="print(1)" language="python" />);

    expect(screen.getByTestId("monaco")).toHaveValue("print(1)");
  });

  it("shows the placeholder when there is no code and not read-only", () => {
    renderWithMantine(<CodeHighlighter code="" language="python" placeholder="Type here..." />);

    expect(screen.getByText("Type here...")).toBeInTheDocument();
  });

  it("hides the placeholder when read-only", () => {
    renderWithMantine(
      <CodeHighlighter code="" language="python" placeholder="Type here..." readOnly />
    );

    expect(screen.queryByText("Type here...")).not.toBeInTheDocument();
  });

  it("propagates editor changes via onChange", () => {
    const onChange = vi.fn();

    renderWithMantine(<CodeHighlighter code="" language="python" onChange={onChange} />);

    fireEvent.change(screen.getByTestId("monaco"), { target: { value: "x = 1" } });

    expect(onChange).toHaveBeenCalledWith("x = 1");
  });

  it("shows the language chip in the header strip", () => {
    renderWithMantine(<CodeHighlighter code="print(1)" language="python" />);

    expect(screen.getByText("python")).toBeInTheDocument();
  });

  it("copies the code from the header copy button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, { clipboard: { writeText } });

    renderWithMantine(<CodeHighlighter code="print(1)" language="python" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

    expect(writeText).toHaveBeenCalledWith("print(1)");
  });

  it("disables the copy button when there is no code", () => {
    renderWithMantine(<CodeHighlighter code="" language="python" />);

    expect(screen.getByRole("button", { name: "Copy code" })).toBeDisabled();
  });

  it("marks the frame invalid when the invalid prop is set", () => {
    const { container } = renderWithMantine(
      <CodeHighlighter code="print(1)" language="python" invalid />
    );

    expect(container.querySelector("[data-invalid]")).toBeInTheDocument();
  });
});
