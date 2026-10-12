import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { GraderBreadcrumb } from "./GraderBreadcrumb";

const renderBreadcrumb = (props: Partial<React.ComponentProps<typeof GraderBreadcrumb>> = {}) =>
  render(
    <MemoryRouter>
      <GraderBreadcrumb isGradebook={false} {...props} />
    </MemoryRouter>
  );

describe("GraderBreadcrumb", () => {
  it("marks Assignments as the current page on the grader landing page", () => {
    renderBreadcrumb();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });

    expect(within(breadcrumb).getByRole("list")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("Assignments")).toHaveAttribute("aria-current", "page");
  });

  it("links back to Assignments and marks Gradebook as current", () => {
    renderBreadcrumb({ isGradebook: true });

    expect(screen.getByRole("link", { name: "Assignments" })).toHaveAttribute("href", "/grader");
    expect(screen.getByText("Gradebook")).toHaveAttribute("aria-current", "page");
  });

  it("exposes the assignment and question hierarchy with progress", () => {
    renderBreadcrumb({
      assignment: { id: 12, name: "Quiz 1" },
      questionId: 34,
      progress: { autograded: 2, graded: 3, total: 8 }
    });

    expect(screen.getByRole("link", { name: "Assignments" })).toHaveAttribute("href", "/grader");
    expect(screen.getByRole("link", { name: "Quiz 1" })).toHaveAttribute("href", "/grader/12");
    expect(screen.getByText(/Question #34/)).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("5 of 8 students graded")).toBeInTheDocument();
  });
});
