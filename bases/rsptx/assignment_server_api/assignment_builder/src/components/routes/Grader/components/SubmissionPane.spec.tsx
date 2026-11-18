import type { GraderAnswerHistoryItem, GraderStudentAnswer } from "@store/grader/grader.logic.api";
import { vi } from "vitest";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { SubmissionPane } from "./SubmissionPane";

const mocks = vi.hoisted(() => ({
  history: [
    { id: 1, answer: "first", timestamp: "2026-01-01T00:00:00Z" },
    { id: 2, answer: "second", timestamp: "2026-01-02T00:00:00Z" }
  ] as GraderAnswerHistoryItem[]
}));

vi.mock("@store/grader/grader.logic.api", () => ({
  useGetGraderHistoryQuery: () => ({ data: { history: mocks.history } })
}));

vi.mock("./questionTypes", () => ({
  AnswerRenderer: () => <div>Answer preview</div>,
  formatCompactAnswer: () => "Answer"
}));

const student: GraderStudentAnswer = {
  sid: "student-1",
  answer: "second",
  attempts: 2,
  max_points: 2
};

describe("SubmissionPane", () => {
  it("puts the accessible attempt name and value on the slider thumb", async () => {
    renderWithMantine(
      <SubmissionPane
        assignmentId={1}
        questionId={2}
        questionName="Question"
        questionType="mchoice"
        student={student}
      />
    );

    const slider = await screen.findByRole("slider", { name: "Attempt 2 of 2" });

    expect(slider).toHaveAttribute("aria-valuenow", "1");
    expect(document.querySelector("[aria-valuetext]:not([role='slider'])")).toBeNull();
  });
});
