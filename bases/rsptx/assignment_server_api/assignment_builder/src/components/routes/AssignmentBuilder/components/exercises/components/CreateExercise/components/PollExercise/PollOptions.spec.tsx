import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { PollOptions } from "./PollOptions";

vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor",
  () => ({
    Editor: ({ content }: { content: string }) => <div data-testid="editor">{content}</div>
  })
);

vi.mock("./PollOptions.module.css", () => ({ default: {} }));

const makeOptions = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `option-${i + 1}`, choice: `Choice ${i + 1}` }));

describe("PollOptions", () => {
  it("renders one editor per option", () => {
    renderWithMantine(<PollOptions options={makeOptions(3)} onChange={vi.fn()} />);

    expect(screen.getAllByTestId("editor")).toHaveLength(3);
  });

  it("adds a new option when Add Option is clicked", () => {
    const onChange = vi.fn();

    renderWithMantine(<PollOptions options={makeOptions(2)} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add option" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(3);
  });

  it("disables the remove buttons when only two options remain", () => {
    renderWithMantine(<PollOptions options={makeOptions(2)} onChange={vi.fn()} />);

    screen.getAllByRole("button", { name: "Remove option" }).forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("removes an empty option immediately when more than two exist", () => {
    const onChange = vi.fn();
    const options = [...makeOptions(2), { id: "option-3", choice: "" }];

    renderWithMantine(<PollOptions options={options} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove option" })[2]);

    expect(onChange).toHaveBeenCalledWith([
      { id: "option-1", choice: "Choice 1" },
      { id: "option-2", choice: "Choice 2" }
    ]);
  });

  it("asks for confirmation before removing an option with content", async () => {
    const onChange = vi.fn();

    renderWithMantine(<PollOptions options={makeOptions(3)} onChange={onChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove option" })[0]);
    expect(onChange).not.toHaveBeenCalled();

    expect(
      await screen.findByText("Remove this option? Its content can't be restored.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onChange).toHaveBeenCalledWith([
      { id: "option-2", choice: "Choice 2" },
      { id: "option-3", choice: "Choice 3" }
    ]);
  });
});
