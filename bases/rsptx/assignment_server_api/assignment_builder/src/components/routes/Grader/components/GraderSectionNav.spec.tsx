import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { GraderSectionNav } from "./GraderSectionNav";

const renderNav = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <GraderSectionNav />
    </MemoryRouter>
  );

describe("GraderSectionNav", () => {
  it.each(["/grader", "/grader/12", "/grader/12/questions/34"])(
    "keeps Assignments active on %s",
    (path) => {
      renderNav(path);

      expect(screen.getByRole("link", { name: "Assignments" })).toHaveAttribute(
        "aria-current",
        "page"
      );
      expect(screen.getByRole("link", { name: "Gradebook" })).not.toHaveAttribute("aria-current");
    }
  );

  it.each(["/gradebook", "/grader/gradebook"])("keeps Gradebook active on %s", (path) => {
    renderNav(path);

    expect(screen.getByRole("link", { name: "Gradebook" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Assignments" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Gradebook" })).toHaveAttribute("href", "/gradebook");
  });
});
