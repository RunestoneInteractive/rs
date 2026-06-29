import { renderWithMantine } from "@/test/renderWithMantine";
import { fireEvent, screen } from "@testing-library/react";

import { ImportQuestionJsonModal } from "./ImportQuestionJsonModal";

vi.mock("@/hooks/useExerciseTypes", () => ({
  useExerciseTypes: () => [
    { value: "mchoice", label: "Multiple Choice", color: {}, tag: "mchoice" },
    { value: "iframe", label: "iFrame", color: {}, tag: "iframe" }
  ]
}));

describe("ImportQuestionJsonModal", () => {
  it("requires a question type before applying in create mode", () => {
    const onApply = vi.fn();

    renderWithMantine(<ImportQuestionJsonModal opened onClose={vi.fn()} onApply={onApply} />);

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByText(/select a question type first/i)).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows a parse error for invalid JSON", () => {
    const onApply = vi.fn();

    renderWithMantine(
      <ImportQuestionJsonModal opened onClose={vi.fn()} onApply={onApply} lockedType="iframe" />
    );

    fireEvent.change(screen.getByPlaceholderText(/statement/i), {
      target: { value: "{ broken" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByText(/not valid json/i)).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows validation errors when required fields are missing", () => {
    const onApply = vi.fn();

    renderWithMantine(
      <ImportQuestionJsonModal opened onClose={vi.fn()} onApply={onApply} lockedType="iframe" />
    );

    fireEvent.change(screen.getByPlaceholderText(/statement/i), {
      target: { value: "{}" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByText(/iframeSrc/)).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("applies valid JSON for the locked type", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    renderWithMantine(
      <ImportQuestionJsonModal
        opened
        onClose={onClose}
        onApply={onApply}
        lockedType="iframe"
        initialJson='{ "iframeSrc": "https://example.com" }'
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith("iframe", { iframeSrc: "https://example.com" });
    expect(onClose).toHaveBeenCalled();
  });

  it("hides the type selector when a type is locked", () => {
    renderWithMantine(
      <ImportQuestionJsonModal opened onClose={vi.fn()} onApply={vi.fn()} lockedType="iframe" />
    );

    expect(screen.queryByText("Question type")).not.toBeInTheDocument();
  });
});
