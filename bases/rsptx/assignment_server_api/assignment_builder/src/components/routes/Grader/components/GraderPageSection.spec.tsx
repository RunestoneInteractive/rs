import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GraderPageSection } from "./GraderPageSection";

describe("GraderPageSection", () => {
  it("labels the page region with a level-two heading", () => {
    render(
      <GraderPageSection heading="Assignments" pathname="/grader">
        <p>Page content</p>
      </GraderPageSection>
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Assignments" });

    expect(screen.getByRole("region", { name: "Assignments" })).toBeInTheDocument();
    expect(heading).toHaveFocus();
  });

  it("moves focus to the new heading after client-side navigation", () => {
    const { rerender } = render(
      <GraderPageSection heading="Assignments" pathname="/grader">
        <p>Page content</p>
      </GraderPageSection>
    );

    rerender(
      <GraderPageSection heading="Gradebook" pathname="/gradebook">
        <p>Page content</p>
      </GraderPageSection>
    );

    expect(screen.getByRole("heading", { level: 2, name: "Gradebook" })).toHaveFocus();
  });
});
