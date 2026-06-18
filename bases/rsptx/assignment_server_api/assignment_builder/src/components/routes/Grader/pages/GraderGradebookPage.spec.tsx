import { renderWithMantine, screen } from "@/test/renderWithMantine";
import type { GradebookResponse } from "@store/grader/grader.logic.api";

import { GraderGradebookPage } from "./GraderGradebookPage";

const { mockUseGetGradebookQuery, mockSetManualTotal } = vi.hoisted(() => ({
  mockUseGetGradebookQuery: vi.fn(),
  mockSetManualTotal: vi.fn(() => ({ unwrap: () => Promise.resolve({}) }))
}));

vi.mock("@store/grader/grader.logic.api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@store/grader/grader.logic.api")>();
  return {
    ...original,
    useGetGradebookQuery: mockUseGetGradebookQuery,
    useSetManualTotalMutation: () => [mockSetManualTotal, { isLoading: false }]
  };
});

const matrix: GradebookResponse = {
  assignments: [
    { id: 1, name: "Quiz 1", points: 10, duedate: null, released: true },
    { id: 2, name: "Quiz 2", points: 5, duedate: null, released: false }
  ],
  students: [
    { sid: "s1", name: "Ada Lovelace" },
    { sid: "s2", name: "Alan Turing" }
  ],
  cells: [
    { sid: "s1", assignment_id: 1, score: 8, released: true },
    { sid: "s1", assignment_id: 2, score: 5, released: false },
    { sid: "s2", assignment_id: 1, score: 6, released: true },
    { sid: "s2", assignment_id: 2, score: null, released: false }
  ],
  averages: { "1": 7, "2": 5 }
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GraderGradebookPage", () => {
  it("shows a loader while fetching", () => {
    mockUseGetGradebookQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithMantine(<GraderGradebookPage />);
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("renders the assignment columns, students and totals", () => {
    mockUseGetGradebookQuery.mockReturnValue({ data: matrix, isLoading: false });
    renderWithMantine(<GraderGradebookPage />);

    expect(screen.getByText("Quiz 1")).toBeInTheDocument();
    expect(screen.getByText("Quiz 2")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Alan Turing")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("Class average")).toBeInTheDocument();
  });

  it("renders an Export CSV download link to the CSV endpoint", () => {
    mockUseGetGradebookQuery.mockReturnValue({ data: matrix, isLoading: false });
    renderWithMantine(<GraderGradebookPage />);

    const link = screen.getByRole("link", { name: /export csv/i });
    expect(link).toHaveAttribute("href", "/assignment/instructor/grader/gradebook.csv");
    expect(link).toHaveAttribute("download");
  });

  it("shows an empty state when there are no students", () => {
    mockUseGetGradebookQuery.mockReturnValue({
      data: { ...matrix, students: [] },
      isLoading: false
    });
    renderWithMantine(<GraderGradebookPage />);
    expect(screen.getByText("Nothing to grade yet")).toBeInTheDocument();
  });
});
