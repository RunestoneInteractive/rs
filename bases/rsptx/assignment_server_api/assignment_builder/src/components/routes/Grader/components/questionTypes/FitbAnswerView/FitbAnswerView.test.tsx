import { describe, expect, it } from "vitest";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { AnswerRendererProps } from "../types";

import { FitbAnswerView } from "./FitbAnswerView";

const baseProps = (answer: string): AnswerRendererProps => ({
  answer,
  history: [],
  questionName: "q-div-1",
  questionId: 7,
  sid: "student1"
});

describe("FitbAnswerView", () => {
  it("renders one blank per element of a JSON array answer", () => {
    renderWithMantine(<FitbAnswerView {...baseProps('["foo", "bar"]')} />);
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
  });

  it("wraps a non-array JSON scalar in a single blank", () => {
    renderWithMantine(<FitbAnswerView {...baseProps("5")} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("falls back to comma splitting for non-JSON answers", () => {
    renderWithMantine(<FitbAnswerView {...baseProps("p,q")} />);
    expect(screen.getByText("p")).toBeInTheDocument();
    expect(screen.getByText("q")).toBeInTheDocument();
  });

  it("renders an empty marker for a blank answer", () => {
    renderWithMantine(<FitbAnswerView {...baseProps("")} />);
    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });

  it("labels individual empty blanks within a filled array", () => {
    renderWithMantine(<FitbAnswerView {...baseProps('["", "x"]')} />);
    expect(screen.getByText("(empty)")).toBeInTheDocument();
    expect(screen.getByText("x")).toBeInTheDocument();
  });
});
