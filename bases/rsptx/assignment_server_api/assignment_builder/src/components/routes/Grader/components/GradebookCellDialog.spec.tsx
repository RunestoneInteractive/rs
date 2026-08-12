import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { renderWithMantine, screen } from "@/test/renderWithMantine";
import type { StudentAssignmentScoresResponse } from "@store/grader/grader.logic.api";

import { GradebookCellDialog } from "./GradebookCellDialog";

const { mockUseScoresQuery, mockRegrade } = vi.hoisted(() => ({
  mockUseScoresQuery: vi.fn(),
  mockRegrade: vi.fn()
}));

vi.mock("@store/grader/grader.logic.api", () => ({
  useGetStudentAssignmentScoresQuery: mockUseScoresQuery,
  useRegradeMutation: () => [mockRegrade, { isLoading: false }],
  useSetManualTotalMutation: () => [
    vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
    { isLoading: false }
  ]
}));

vi.mock("@/components/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() }
}));

const assignment = { id: 7, name: "Quiz 1", points: 10, duedate: null, released: true };
const student = { sid: "ada@example.com", name: "Ada Lovelace" };

const detail: StudentAssignmentScoresResponse = {
  assignment_id: 7,
  assignment_name: "Quiz 1",
  assignment_points: 10,
  username: "ada@example.com",
  student_name: "Ada Lovelace",
  total_score: 8,
  manual_total: false,
  questions: [
    {
      id: 1,
      name: "q_one",
      qnumber: "1.2.3",
      points: 5,
      score: 5,
      comment: "autograded"
    },
    { id: 2, name: "q_two", qnumber: null, points: 5, score: 3, comment: "nice work" }
  ]
};

const renderDialog = (props: Partial<React.ComponentProps<typeof GradebookCellDialog>> = {}) =>
  renderWithMantine(
    <MemoryRouter>
      <GradebookCellDialog
        opened
        onClose={vi.fn()}
        assignment={assignment}
        student={student}
        score={8}
        manual={false}
        {...props}
      />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockRegrade.mockReturnValue({
    unwrap: () =>
      Promise.resolve({
        total: 2,
        changed: 1,
        skipped_manual: 0,
        no_submission: 0,
        errors: 0,
        items: []
      })
  });
  mockUseScoresQuery.mockReturnValue({ data: detail, isFetching: false, isError: false });
});

describe("GradebookCellDialog", () => {
  it("renders nothing without a cell to describe", () => {
    renderDialog({ assignment: null, student: null });

    expect(screen.queryByText(/Assignment total/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Question scores" })).not.toBeInTheDocument();
  });

  it("skips the fetch while it is closed", () => {
    renderDialog({ opened: false });
    expect(mockUseScoresQuery).toHaveBeenCalledWith(
      { assignmentId: 7, sid: "ada@example.com" },
      { skip: true }
    );
  });

  it("shows the total and one row per question", () => {
    renderDialog();

    expect(screen.getByText("Assignment total: 8 / 10 points")).toBeInTheDocument();
    // The question number the student sees wins over the div_id...
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
    // ...but a question without a number falls back to it.
    expect(screen.getByText("q_two")).toBeInTheDocument();
    // A real instructor comment shows; the autograder's placeholder does not.
    expect(screen.getByText("nice work")).toBeInTheDocument();
    expect(screen.queryByText("autograded")).not.toBeInTheDocument();
  });

  it("opens each question on its grading page in a new tab", () => {
    renderDialog();

    const link = screen.getByRole("link", { name: "1.2.3" });

    expect(link).toHaveAttribute("href", "/grader/7/questions/1/students/ada%40example.com");
    expect(link).toHaveAttribute("target", "_blank");
    // The div_id is still reachable when the number is what's displayed.
    expect(link).toHaveAttribute("title", expect.stringContaining("q_one"));

    expect(screen.getByRole("link", { name: "q_two" })).toHaveAttribute(
      "href",
      "/grader/7/questions/2/students/ada%40example.com"
    );
  });

  it("links to the student's full report", () => {
    renderDialog();

    expect(screen.getByRole("link", { name: /See all work for Ada Lovelace/ })).toHaveAttribute(
      "href",
      "/assignment/student/studentreport?id=ada%40example.com"
    );
  });

  it("warns and offers a regrade when the total disagrees with the questions", async () => {
    mockUseScoresQuery.mockReturnValue({
      data: { ...detail, total_score: 2 },
      isFetching: false,
      isError: false
    });
    renderDialog();

    expect(screen.getByText(/The total is out of date/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Regrade this student" }));

    expect(mockRegrade).toHaveBeenCalledWith({
      assignment_id: 7,
      question_ids: [1, 2],
      sids: ["ada@example.com"],
      overwrite_manual: false,
      enforce_deadline: true,
      recompute_totals: true
    });
    expect(await screen.findByText(/Regraded 2 questions, 1 changed/)).toBeInTheDocument();
  });

  it("explains a hand-entered total instead of calling it stale", () => {
    mockUseScoresQuery.mockReturnValue({
      data: { ...detail, total_score: 2, manual_total: true },
      isFetching: false,
      isError: false
    });
    renderDialog({ manual: true });

    expect(screen.queryByText(/The total is out of date/)).not.toBeInTheDocument();
    expect(screen.getByText(/entered by hand/)).toBeInTheDocument();
  });

  it("reports a failed load", () => {
    mockUseScoresQuery.mockReturnValue({ data: undefined, isFetching: false, isError: true });
    renderDialog();

    expect(screen.getByText(/Could not load the scores/)).toBeInTheDocument();
  });
});
