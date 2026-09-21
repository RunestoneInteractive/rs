import type { GraderQuestionsResponse } from "@store/grader/grader.logic.api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, renderWithMantine, screen } from "@/test/renderWithMantine";

import { GraderQuestionsPage } from "./GraderQuestionsPage";

const { mockUseGetGraderQuestionsQuery, mockParams } = vi.hoisted(() => ({
  mockUseGetGraderQuestionsQuery: vi.fn(),
  mockParams: { assignmentId: "1" }
}));

vi.mock("@store/grader/grader.logic.api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@store/grader/grader.logic.api")>();

  return {
    ...original,
    useGetGraderQuestionsQuery: mockUseGetGraderQuestionsQuery
  };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => mockParams
}));

// These own their own queries and dialogs; the page only decides whether to
// show them, which their own specs cover.
vi.mock("../components/ThresholdControl", () => ({ ThresholdControl: () => null }));
vi.mock("../components/ReleaseGradesControl", () => ({ ReleaseGradesControl: () => null }));
vi.mock("../components/RegradeWizard", () => ({ RegradeWizard: () => null }));
vi.mock("../components/MultiGradeDialog", () => ({ MultiGradeDialog: () => null }));
vi.mock("../components/DeadlineExceptionDialog", () => ({ DeadlineExceptionDialog: () => null }));

const makeQuestions = (count: number): GraderQuestionsResponse => ({
  assignment: { id: 1, name: "Quiz 1", points: 10 },
  questions: Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Question ${String(i + 1).padStart(2, "0")}`,
    question_type: "mchoice",
    points: 5,
    answered_count: 10,
    total_attempts: 12,
    correct_count: 7,
    average_score: 3.5
  }))
});

describe("GraderQuestionsPage table pagination", () => {
  beforeEach(() => {
    localStorage.clear();
    mockParams.assignmentId = "1";
    // The table view is the one with a pager; cards are the default.
    localStorage.setItem("grader.questionsViewMode", "table");
    mockUseGetGraderQuestionsQuery.mockReturnValue({
      data: makeQuestions(30),
      isLoading: false
    });
  });

  const storePage = (pageIndex: number, pageSize: number, scope = "1") => {
    localStorage.setItem("grader.questionsTable_pageSize", String(pageSize));
    localStorage.setItem("grader.questionsTable_pageIndex", String(pageIndex));
    localStorage.setItem("grader.questionsTable_scope", scope);
  };

  it("restores the stored page and page size", () => {
    storePage(1, 10);

    renderWithMantine(<GraderQuestionsPage />);

    expect(screen.getByText("Question 11")).toBeInTheDocument();
    expect(screen.queryByText("Question 01")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rows per page" })).toHaveValue("10");
  });

  it("persists the page and page size when they change", () => {
    renderWithMantine(<GraderQuestionsPage />);

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(localStorage.getItem("grader.questionsTable_pageIndex")).toBe("1");

    fireEvent.click(screen.getByRole("textbox", { name: "Rows per page" }));
    fireEvent.click(screen.getByRole("option", { name: "10" }));

    expect(localStorage.getItem("grader.questionsTable_pageSize")).toBe("10");
    expect(localStorage.getItem("grader.questionsTable_pageIndex")).toBe("0");
  });

  it("starts a different assignment on the first page but keeps the page size", () => {
    storePage(2, 10);

    const { unmount } = renderWithMantine(<GraderQuestionsPage />);

    expect(screen.getByText("Question 21")).toBeInTheDocument();
    unmount();

    mockParams.assignmentId = "2";
    renderWithMantine(<GraderQuestionsPage />);

    expect(screen.getByText("Question 01")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rows per page" })).toHaveValue("10");
  });

  it("pulls back to the last page when a column filter shrinks the table", () => {
    storePage(2, 10);

    renderWithMantine(<GraderQuestionsPage />);

    expect(screen.getByText("Question 21")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Filter by Name" }), {
      target: { value: "Question 0" }
    });

    expect(screen.getByText("Question 01")).toBeInTheDocument();
  });
});
