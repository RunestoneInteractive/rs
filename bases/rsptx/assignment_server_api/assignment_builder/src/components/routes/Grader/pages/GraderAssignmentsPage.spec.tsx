import { beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, renderWithMantine, screen } from "@/test/renderWithMantine";

import { GraderAssignmentsPage } from "./GraderAssignmentsPage";

const { mockUseGetAssignmentsQuery } = vi.hoisted(() => ({
  mockUseGetAssignmentsQuery: vi.fn()
}));

vi.mock("@store/assignment/assignment.logic.api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@store/assignment/assignment.logic.api")>();

  return {
    ...original,
    useGetAssignmentsQuery: mockUseGetAssignmentsQuery
  };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn()
}));

const makeAssignments = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Assignment ${String(i + 1).padStart(2, "0")}`,
    description: "",
    duedate: "2026-06-01T10:00:00",
    points: 10,
    released: true
  }));

describe("GraderAssignmentsPage table pagination", () => {
  beforeEach(() => {
    localStorage.clear();
    // The table view is the one with a pager; cards are the default.
    localStorage.setItem("grader.assignmentsViewMode", "table");
    mockUseGetAssignmentsQuery.mockReturnValue({
      data: makeAssignments(30),
      isLoading: false
    });
  });

  it("restores the stored page and page size", () => {
    localStorage.setItem("grader.assignmentsTable_pageSize", "10");
    localStorage.setItem("grader.assignmentsTable_pageIndex", "1");

    renderWithMantine(<GraderAssignmentsPage />);

    expect(screen.getByText("Assignment 11")).toBeInTheDocument();
    expect(screen.queryByText("Assignment 01")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rows per page" })).toHaveValue("10");
  });

  it("persists the page and page size when they change", () => {
    renderWithMantine(<GraderAssignmentsPage />);

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(localStorage.getItem("grader.assignmentsTable_pageIndex")).toBe("1");

    fireEvent.click(screen.getByRole("textbox", { name: "Rows per page" }));
    fireEvent.click(screen.getByRole("option", { name: "10" }));

    expect(localStorage.getItem("grader.assignmentsTable_pageSize")).toBe("10");
    expect(localStorage.getItem("grader.assignmentsTable_pageIndex")).toBe("0");
  });

  it("falls back to the last page when the stored page no longer exists", () => {
    localStorage.setItem("grader.assignmentsTable_pageSize", "25");
    localStorage.setItem("grader.assignmentsTable_pageIndex", "4");
    mockUseGetAssignmentsQuery.mockReturnValue({
      data: makeAssignments(3),
      isLoading: false
    });

    renderWithMantine(<GraderAssignmentsPage />);

    expect(screen.getByText("Assignment 01")).toBeInTheDocument();
  });
});
