import type { GradebookResponse } from "@store/grader/grader.logic.api";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMantine, screen, within } from "@/test/renderWithMantine";

import { GraderGradebookPage } from "./GraderGradebookPage";

const { mockUseGetGradebookQuery, mockCellDialog, mockLateDialog, mockUnitsToggle, mockRefetch } =
  vi.hoisted(() => ({
    mockUseGetGradebookQuery: vi.fn(),
    mockCellDialog: vi.fn(),
    mockLateDialog: vi.fn(),
    mockUnitsToggle: vi.fn(),
    mockRefetch: vi.fn()
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

vi.mock("../components/GradebookLateWorkDialog", () => ({
  GradebookLateWorkDialog: (props: Record<string, unknown>) => {
    mockLateDialog(props);
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
    { sid: "s1", name: "Ada Lovelace", email: "ada@example.com" },
    { sid: "s2", name: "Alan Turing", email: "alan@example.com" }
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
  mockUseGetGradebookQuery.mockReturnValue({
    data: matrix,
    isLoading: false,
    isError: false,
    refetch: mockRefetch
  });
});

describe("GraderGradebookPage", () => {
  it("shows a loader while fetching", () => {
    mockUseGetGradebookQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithMantine(<GraderGradebookPage />);
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("shows a retryable error instead of an empty gradebook when loading fails", async () => {
    mockUseGetGradebookQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch
    });
    renderWithMantine(<GraderGradebookPage />);

    expect(
      screen.getByRole("heading", { name: "Could not load the gradebook" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Nothing to grade yet")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("renders the assignment columns, students and totals", () => {
    renderWithMantine(<GraderGradebookPage />);
    // Scoped to the table: the assignment names also appear in the column filter.
    const table = within(screen.getByRole("table", { name: "Gradebook" }));

    expect(table.getByText("Quiz 1")).toBeInTheDocument();
    expect(table.getByText("Homework 2")).toBeInTheDocument();
    expect(table.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(table.getByText("ada@example.com")).toBeInTheDocument();
    expect(table.getByText("Alan Turing")).toBeInTheDocument();
    expect(table.getByText("13")).toBeInTheDocument();
    expect(table.getByText("Class average")).toBeInTheDocument();
    const averageRow = table.getByRole("row", { name: /Class average/ });

    expect(
      within(averageRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
    ).toEqual(["7", "5", "9.5"]);
    expect(table.getByRole("link", { name: "s1" })).toHaveAttribute(
      "href",
      "/assignment/student/studentreport?id=s1"
    );
  });

  it('labels each row "Last, First" so the last-name order the rows arrive in reads as an order', () => {
    mockUseGetGradebookQuery.mockReturnValue({
      data: {
        ...matrix,
        students: [
          { sid: "s1", name: "Ada Lovelace", sort_name: "Lovelace, Ada" },
          { sid: "s2", name: "Alan Turing", sort_name: "Turing, Alan" }
        ]
      },
      isLoading: false
    });
    renderWithMantine(<GraderGradebookPage />);

    const table = within(screen.getByRole("table", { name: "Gradebook" }));

    expect(table.getByText("Lovelace, Ada")).toBeInTheDocument();
    expect(table.getByText("Turing, Alan")).toBeInTheDocument();
    // The natural name still drives the per-cell label, which reads as prose.
    expect(
      table.getByRole("button", { name: "Show details for Ada Lovelace on Quiz 1" })
    ).toBeInTheDocument();
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

  it("renders an Export CSV button for the current view", () => {
    renderWithMantine(<GraderGradebookPage />);

    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
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

    await userEvent.type(
      screen.getByLabelText("Filter students by name, username, or email"),
      "turing"
    );

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(screen.getByText("Alan Turing")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 2 students/)).toBeInTheDocument();
  });

  it("sorts by student and by an assignment score", async () => {
    renderWithMantine(<GraderGradebookPage />);
    const table = screen.getByRole("table", { name: "Gradebook" });
    const studentNames = () =>
      within(table)
        .getAllByRole("row")
        .slice(1, 3)
        .map((row) => within(row).getAllByRole("cell")[0].firstElementChild?.textContent);

    expect(studentNames()).toEqual(["Ada Lovelace", "Alan Turing"]);

    await userEvent.click(within(table).getByRole("button", { name: "Sort by student" }));
    expect(studentNames()).toEqual(["Alan Turing", "Ada Lovelace"]);

    await userEvent.click(within(table).getByRole("button", { name: "Sort by Quiz 1 score" }));
    expect(studentNames()).toEqual(["Alan Turing", "Ada Lovelace"]);

    await userEvent.click(within(table).getByRole("button", { name: "Sort by Quiz 1 score" }));
    expect(studentNames()).toEqual(["Ada Lovelace", "Alan Turing"]);
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
    const averageRow = table.getByRole("row", { name: /Class average/ });

    expect(
      within(averageRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
    ).toEqual(["5", "5"]);
    expect(screen.getByText(/1 of 2 assignments/)).toBeInTheDocument();
  });

  it("shows multiple selected assignments while also filtering students", async () => {
    mockUseGetGradebookQuery.mockReturnValue({
      data: {
        ...matrix,
        assignments: [
          ...matrix.assignments,
          { id: 3, name: "Exam 3", points: 20, duedate: null, released: true }
        ]
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch
    });
    renderWithMantine(<GraderGradebookPage />);

    const assignmentFilter = screen.getAllByLabelText("Filter assignment columns by name")[0];

    await userEvent.click(assignmentFilter);
    await userEvent.click(await screen.findByRole("option", { name: "Quiz 1" }));
    await userEvent.click(assignmentFilter);
    await userEvent.click(await screen.findByRole("option", { name: "Homework 2" }));
    await userEvent.type(
      screen.getByLabelText("Filter students by name, username, or email"),
      "turing"
    );

    const table = within(screen.getByRole("table", { name: "Gradebook" }));

    expect(table.getByText("Quiz 1")).toBeInTheDocument();
    expect(table.getByText("Homework 2")).toBeInTheDocument();
    expect(table.queryByText("Exam 3")).not.toBeInTheDocument();
    expect(table.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(table.getByText("Alan Turing")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 2 students and 2 of 3 assignments/)).toBeInTheDocument();
  });

  it("tells the reader when the filters match nothing", async () => {
    renderWithMantine(<GraderGradebookPage />);

    await userEvent.type(
      screen.getByLabelText("Filter students by name, username, or email"),
      "nobody"
    );

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

  it("opens late work for a real assignment", async () => {
    renderWithMantine(<GraderGradebookPage />);

    expect(mockLateDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ opened: false, assignment: null })
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Show students with late work for Quiz 1" })
    );

    expect(mockLateDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        opened: true,
        assignment: expect.objectContaining({ id: 1, name: "Quiz 1" })
      })
    );
  });

  it("renders Practice as a grade column without an assignment drill-down", () => {
    mockUseGetGradebookQuery.mockReturnValue({
      data: {
        ...matrix,
        assignments: [
          { id: 0, name: "Practice", points: 5, duedate: null, released: true, kind: "practice" },
          ...matrix.assignments
        ],
        cells: [
          {
            sid: "s1",
            assignment_id: 0,
            score: 4,
            released: true,
            manual_total: false
          },
          ...matrix.cells
        ]
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch
    });
    renderWithMantine(<GraderGradebookPage />);

    const table = within(screen.getByRole("table", { name: "Gradebook" }));

    expect(table.getByText("Practice")).toBeInTheDocument();
    expect(table.getAllByTitle("Spaced practice score")[0]).toHaveTextContent("4");
    expect(
      table.queryByRole("button", { name: "Show details for Ada Lovelace on Practice" })
    ).not.toBeInTheDocument();
  });
});
