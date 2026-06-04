import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { MultiChoiceOptions, OptionWithId } from "./MultiChoiceOptions";

vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor",
  () => ({
    Editor: ({ content }: { content: string }) => <div data-testid="editor">{content}</div>
  })
);

const buildOptions = (): OptionWithId[] => [
  { id: "a", choice: "Alpha", feedback: "", correct: true },
  { id: "b", choice: "Beta", feedback: "", correct: false }
];

describe("MultiChoiceOptions", () => {
  it("adds a new option", async () => {
    const onChange = vi.fn();

    renderWithMantine(<MultiChoiceOptions options={buildOptions()} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Add option" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(3);
  });

  it("removes an empty option immediately when more than two exist", async () => {
    const onChange = vi.fn();
    const options: OptionWithId[] = [
      ...buildOptions(),
      { id: "c", choice: "", feedback: "", correct: false }
    ];

    renderWithMantine(<MultiChoiceOptions options={options} onChange={onChange} />);

    await userEvent.click(screen.getAllByRole("button", { name: "Remove option" })[2]);

    expect(onChange).toHaveBeenCalledWith([options[0], options[1]]);
  });

  it("asks for confirmation before removing an option with content", async () => {
    const onChange = vi.fn();
    const options: OptionWithId[] = [
      ...buildOptions(),
      { id: "c", choice: "Gamma", feedback: "", correct: false }
    ];

    renderWithMantine(<MultiChoiceOptions options={options} onChange={onChange} />);

    await userEvent.click(screen.getAllByRole("button", { name: "Remove option" })[2]);
    expect(onChange).not.toHaveBeenCalled();

    expect(
      await screen.findByText("Remove this option? Its content can't be restored.")
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith([options[0], options[1]]);
  });

  it("disables remove when only two options remain", () => {
    renderWithMantine(<MultiChoiceOptions options={buildOptions()} onChange={vi.fn()} />);

    const removeButtons = screen.getAllByRole("button", { name: "Remove option" });
    removeButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("toggles the correct flag for an option", async () => {
    const onChange = vi.fn();

    renderWithMantine(<MultiChoiceOptions options={buildOptions()} onChange={onChange} />);

    const correctCheckboxes = screen.getAllByRole("checkbox", { name: "Correct" });
    await userEvent.click(correctCheckboxes[1]);

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "b", correct: true })])
    );
  });
});
