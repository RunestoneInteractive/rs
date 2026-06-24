import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { ShortAnswerInstructions } from "./ShortAnswerInstructions";

vi.mock(
  "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor",
  () => ({
    Editor: ({ content }: { content: string }) => <div data-testid="editor">{content}</div>
  })
);

vi.mock("../../../shared/ExerciseLayout", () => ({
  useValidation: () => ({ shouldShowValidation: false })
}));

vi.mock("../../../shared/styles/CreateExercise.module.css", () => ({ default: {} }));

const baseProps = {
  instructions: "Answer the question",
  onChange: vi.fn(),
  attachment: false,
  onAttachmentChange: vi.fn()
};

describe("ShortAnswerInstructions", () => {
  it("renders the instructions editor", () => {
    renderWithMantine(<ShortAnswerInstructions {...baseProps} />);

    expect(screen.getByTestId("editor")).toHaveTextContent("Answer the question");
  });

  it("reflects the attachment checkbox state", () => {
    renderWithMantine(<ShortAnswerInstructions {...baseProps} attachment={true} />);

    expect(screen.getByRole("checkbox", { name: /Allow file attachments/ })).toBeChecked();
  });

  it("calls onAttachmentChange when the checkbox is toggled", () => {
    const onAttachmentChange = vi.fn();

    renderWithMantine(
      <ShortAnswerInstructions {...baseProps} onAttachmentChange={onAttachmentChange} />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Allow file attachments/ }));

    expect(onAttachmentChange).toHaveBeenCalledWith(true);
  });
});
