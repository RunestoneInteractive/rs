import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { AnswerRendererProps } from "../../types";
import { ParsonsAnswerView } from "../ParsonsAnswerView";
const baseProps = (answer: string): AnswerRendererProps => ({
  answer,
  history: [],
  questionName: "q-div-1",
  questionId: 7,
  sid: "student1"
});

describe("ParsonsAnswerView", () => {
  it("splits a dash-joined answer into ordered blocks with a count", () => {
    renderWithMantine(<ParsonsAnswerView {...baseProps("one - two - three")} />);
    expect(screen.getByText("Reconstructed block order (3)")).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
    expect(screen.getByText("three")).toBeInTheDocument();
  });

  it("shows a zero count and a no-blocks note for an empty answer", () => {
    renderWithMantine(<ParsonsAnswerView {...baseProps("")} />);
    expect(screen.getByText("Reconstructed block order (0)")).toBeInTheDocument();
    expect(screen.getByText("(no blocks submitted)")).toBeInTheDocument();
  });
});
