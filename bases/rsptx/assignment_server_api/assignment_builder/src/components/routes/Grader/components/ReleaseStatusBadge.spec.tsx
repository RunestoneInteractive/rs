import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ReleaseStatusBadge } from "./ReleaseStatusBadge";

describe("ReleaseStatusBadge", () => {
  it("labels a released assignment as visible to students", () => {
    renderWithMantine(<ReleaseStatusBadge released={true} />);

    const badge = screen.getByText("Released");

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "Students can see their scores");
  });

  it("labels a hidden assignment as hidden from students", () => {
    renderWithMantine(<ReleaseStatusBadge released={false} />);

    const badge = screen.getByText("Hidden");

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "Scores are hidden from students");
  });

  it("never shows both states at once", () => {
    renderWithMantine(<ReleaseStatusBadge released={true} />);

    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});
