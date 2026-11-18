import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { GradebookLateWorkDialog } from "./GradebookLateWorkDialog";

const { mockUseGetLateStudentsQuery } = vi.hoisted(() => ({
  mockUseGetLateStudentsQuery: vi.fn()
}));

vi.mock("@store/grader/grader.logic.api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@store/grader/grader.logic.api")>();

  return { ...original, useGetLateStudentsQuery: mockUseGetLateStudentsQuery };
});

const assignment = {
  id: 7,
  name: "Quiz 1",
  points: 10,
  duedate: null,
  released: true,
  kind: "assignment" as const
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseGetLateStudentsQuery.mockReturnValue({
    data: {
      assignment_id: 7,
      assignment_name: "Quiz 1",
      enforce_due: true,
      students: []
    },
    isFetching: false,
    isError: false
  });
});

describe("GradebookLateWorkDialog", () => {
  it("skips the request while closed", () => {
    renderWithMantine(
      <GradebookLateWorkDialog opened={false} onClose={vi.fn()} assignment={assignment} />
    );

    expect(mockUseGetLateStudentsQuery).toHaveBeenCalledWith(7, { skip: true });
  });

  it("explains when the deadline is not enforced", () => {
    mockUseGetLateStudentsQuery.mockReturnValue({
      data: { assignment_id: 7, assignment_name: "Quiz 1", enforce_due: false, students: [] },
      isFetching: false,
      isError: false
    });
    renderWithMantine(<GradebookLateWorkDialog opened onClose={vi.fn()} assignment={assignment} />);

    expect(screen.getByText(/due date is not enforced/i)).toBeInTheDocument();
  });

  it("links each late student to the student report", () => {
    mockUseGetLateStudentsQuery.mockReturnValue({
      data: {
        assignment_id: 7,
        assignment_name: "Quiz 1",
        enforce_due: true,
        students: [{ username: "ada@example.com", name: "Ada Lovelace" }]
      },
      isFetching: false,
      isError: false
    });
    renderWithMantine(<GradebookLateWorkDialog opened onClose={vi.fn()} assignment={assignment} />);

    expect(screen.getByRole("link", { name: "Ada Lovelace" })).toHaveAttribute(
      "href",
      "/assignment/student/studentreport?id=ada%40example.com"
    );
    expect(screen.getByRole("dialog")).toHaveClass(/gradebookLateWorkModalContent/);
  });

  it("reports a failed request", () => {
    mockUseGetLateStudentsQuery.mockReturnValue({
      data: undefined,
      isFetching: false,
      isError: true
    });
    renderWithMantine(<GradebookLateWorkDialog opened onClose={vi.fn()} assignment={assignment} />);

    expect(screen.getByText(/Could not load late work/)).toBeInTheDocument();
  });
});
