import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { BaseExerciseForm } from "./BaseExerciseForm";

vi.mock("../../TipTap/Editor", () => ({
  Editor: ({ content }: { content: string }) => <div data-testid="rich-editor">{content}</div>
}));

describe("BaseExerciseForm", () => {
  it("renders the title, points, editor and action buttons", () => {
    renderWithMantine(<BaseExerciseForm initialData={{}} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Points")).toBeInTheDocument();
    expect(screen.getByTestId("rich-editor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("blocks save and shows an error when the assignment id is missing", async () => {
    const onSave = vi.fn();

    renderWithMantine(<BaseExerciseForm initialData={{}} onSave={onSave} onCancel={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Save/i }));

    expect(screen.getByText("Couldn't find the assignment. Reopen it from the assignments list.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("surfaces validation errors and does not save", async () => {
    const onSave = vi.fn();

    renderWithMantine(
      <BaseExerciseForm
        initialData={{ assignment_id: 5 }}
        onSave={onSave}
        onCancel={vi.fn()}
        validate={() => ({ isValid: false, errors: ["Title is required"] })}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /Save/i }));

    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves the data when valid", async () => {
    const onSave = vi.fn();

    renderWithMantine(
      <BaseExerciseForm
        initialData={{ assignment_id: 5 }}
        onSave={onSave}
        onCancel={vi.fn()}
        validate={() => ({ isValid: true, errors: [] })}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /Save/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ assignment_id: 5 });
  });
});
