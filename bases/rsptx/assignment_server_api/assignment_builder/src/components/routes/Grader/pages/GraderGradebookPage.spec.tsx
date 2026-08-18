import userEvent from "@testing-library/user-event";

import { renderWithMantine, screen, within } from "@/test/renderWithMantine";
import type { GradebookResponse } from "@store/grader/grader.logic.api";

import { GraderGradebookPage } from "./GraderGradebookPage";

const { mockUseGetGradebookQuery, mockCellDialog, mockUnitsToggle } = vi.hoisted(() => ({
  mockUseGetGradebookQuery: vi.fn(),
  mockCellDialog: vi.fn(),
  mockUnitsToggle: vi.fn()
}));

vi.mock("@store/grader/grader.logic.api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@store/grader/grader.logic.api")>();

  return {
    ...original,
    useGetGradebookQuery: mockUseGetGradebookQuery
  };
});

// The dialog has its own spec; here we only care about what the page hands it.
vi.mock("../components/GradebookCellDialog", () => ({
  GradebookCellDialog: (props: Record<string, unknown>) => {
    mockCellDialog(props);
    return null;
  }
}));

// Likewise the units toggle: it owns the mutation, so the page only has to tell
// it which units the course is on.
vi.mock("../components/GradebookUnitsToggle", () => ({
  GradebookUnitsToggle: (props: Record<string, unknown>) => {
    mockUnitsToggle(props);
    return null;
  }
}));

const matrix: GradebookResponse = {
  assignments: [
    { id: 1, name: "Quiz 1", points: 10, duedate: null, released: true },
    { id: 2, name: "Homework 2", points: 5, duedate: null, released: false }
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
  averages: { "1": 7, "2": 5 },
  // Points are the exception, but they keep these assertions readable; the
  // percent default gets its own test below.
  show_points: true
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseGetGradebookQuery.mockReturnValue({ data: matrix, isLoading: false });
});

describe("GraderGradebookPage", () => {
  it("shows a loader while fetching", () => {
    mockUseGetGradebookQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithMantine(<GraderGradebookPage />);
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("renders the assignment columns, students and totals", () => {
    renderWithMantine(<GraderGradebookPage />);
    // Scoped to the table: the assignment names also appear in the column filter.
    const table = within(screen.getByRole("table", { name: "Gradebook" }));

    expect(table.getByText("Quiz 1")).toBeInTheDocument();
    expect(table.getByText("Homework 2")).toBeInTheDocument();
    expect(table.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(table.getByText("Alan Turing")).toBeInTheDocument();
    expect(table.getByText("13")).toBeInTheDocument();
    expect(table.getByText("Class average")).toBeInTheDocument();
  });

  it("shows each score as a percent of the assignment unless the course wants points", () => {
    mockUseGetGradebookQuery.mockReturnValue({
      data: { ...matrix, show_points: false },
      isLoading: false
    });
    renderWithMantine(<GraderGradebookPage />);

    const table = within(screen.getByRole("table", { name: "Gradebook" }));

    // 8/10 and 5/5 for Ada, 6/10 for Alan, and Ada's 13/15 total.
    expect(table.getByText("80")).toBeInTheDocument();
    expect(table.getByText("86.67")).toBeInTheDocument();
    // Alan was graded only on the 10 point Quiz 1, so his score and his total are
    // both 60% — his ungraded homework is left out of the denominator.
    expect(table.getAllByText("60")).toHaveLength(2);
    // The headers name the units, and no longer advertise the points available.
    expect(table.queryByText("/ 10")).not.toBeInTheDocument();
    expect(table.getAllByText("%").length).toBeGreaterThan(0);
  });

  it("shows points and the points available when the course asks for points", () => {
    renderWithMantine(<GraderGradebookPage />);

    const table = within(screen.getByRole("table", { name: "Gradebook" }));

    expect(table.getByText("/ 10")).toBeInTheDocument();
    expect(table.getByText("8")).toBeInTheDocument();
    expect(table.getByText("13")).toBeInTheDocument();
  });

  it("tells the units toggle which units the course is on", () => {
    renderWithMantine(<GraderGradebookPage />);
    expect(mockUnitsToggle).toHaveBeenCalledWith(expect.objectContaining({ showPoints: true }));

    vi.clearAllMocks();
    mockUseGetGradebookQuery.mockReturnValue({
      data: { ...matrix, show_points: false },
      isLoading: false
    });
    renderWithMantine(<GraderGradebookPage />);
    expect(mockUnitsToggle).toHaveBeenCalledWith(expect.objectContaining({ showPoints: false }));
  });

  it("renders an Export CSV download link to the CSV endpoint", () => {
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

  it("filters rows by student name", async () => {
    renderWithMantine(<GraderGradebookPage />);

    await userEvent.type(screen.getByLabelText("Filter students by name"), "turing");

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(screen.getByText("Alan Turing")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 2 students/)).toBeInTheDocument();
  });

  it("filters columns by assignment name", async () => {
    renderWithMantine(<GraderGradebookPage />);

    // MultiSelect renders a visible search field plus a hidden value input, so
    // the aria-label matches twice; the first is the one a user types into.
    await userEvent.click(screen.getAllByLabelText("Filter assignment columns by name")[0]);
    await userEvent.click(await screen.findByRole("option", { name: "Homework 2" }));

    const table = within(screen.getByRole("table", { name: "Gradebook" }));

    expect(table.queryByText("Quiz 1")).not.toBeInTheDocument();
    expect(table.getByText("Homework 2")).toBeInTheDocument();
    // Only the shown column is added up, and the header says so.
    expect(table.getByText("Total (shown)")).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 assignments/)).toBeInTheDocument();
  });

  it("tells the reader when the filters match nothing", async () => {
    renderWithMantine(<GraderGradebookPage />);

    await userEvent.type(screen.getByLabelText("Filter students by name"), "nobody");

    expect(screen.getByText("Nothing matches these filters")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Gradebook" })).not.toBeInTheDocument();
  });

  it("opens the drill-down for the clicked cell", async () => {
    renderWithMantine(<GraderGradebookPage />);

    expect(mockCellDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ opened: false, assignment: null, student: null })
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Show details for Alan Turing on Quiz 1" })
    );

    expect(mockCellDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        opened: true,
        assignment: expect.objectContaining({ id: 1 }),
        student: expect.objectContaining({ sid: "s2" }),
        score: 6,
        manual: false
      })
    );
  });
});
