import type { GraderStudentAnswer } from "@store/grader/grader.logic.api";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { GradePanel } from "./GradePanel";

const student: GraderStudentAnswer = {
  sid: "ada",
  first_name: "Ada",
  last_name: "Lovelace",
  answer: "",
  attempts: 2,
  score: 4,
  comment: "Good work",
  max_points: 10
};

const renderPanel = () => {
  const onAutoAdvanceChange = vi.fn();

  renderWithMantine(
    <GradePanel
      student={student}
      maxPoints={10}
      score={4}
      comment="Good work"
      status="idle"
      hasPrev
      hasNext
      positionLabel="1 / 3"
      onScoreChange={vi.fn()}
      onCommentChange={vi.fn()}
      onCommentBlur={vi.fn()}
      onScoreBlur={vi.fn()}
      onPrev={vi.fn()}
      onNext={vi.fn()}
      onRetry={vi.fn()}
      autoAdvance={false}
      onAutoAdvanceChange={onAutoAdvanceChange}
    />
  );

  return { onAutoAdvanceChange };
};

describe("GradePanel", () => {
  it("associates grading controls with their accessible labels", () => {
    renderPanel();

    expect(screen.getByLabelText("Points (max 10)")).toBeInTheDocument();
    expect(screen.getByLabelText("Comment")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Ada Lovelace");
  });

  it("labels and updates the auto-advance switch", async () => {
    const { onAutoAdvanceChange } = renderPanel();

    await userEvent.click(screen.getByLabelText("Auto-advance after save"));

    expect(onAutoAdvanceChange).toHaveBeenCalledWith(true);
  });
});
