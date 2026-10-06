import { describe, expect, it } from "vitest";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { AnswerRendererProps } from "../types";

import { McqAnswerView } from "./McqAnswerView";
const baseProps = (overrides: Partial<AnswerRendererProps> = {}): AnswerRendererProps => ({
  answer: "",
  history: [],
  questionName: "q-div-1",
  questionId: 7,
  sid: "student1",
  ...overrides
});

describe("McqAnswerView", () => {
  it("renders one chip per selected option with a singular heading", () => {
    renderWithMantine(<McqAnswerView {...baseProps({ answer: "a", correct: true })} />);
    expect(screen.getByText("Selected option")).toBeInTheDocument();
    expect(screen.getByText("Option a")).toBeInTheDocument();
  });

  it("uses a plural heading and renders every selected option", () => {
    renderWithMantine(<McqAnswerView {...baseProps({ answer: "a,b", correct: false })} />);
    expect(screen.getByText("Selected options")).toBeInTheDocument();
    expect(screen.getByText("Option a")).toBeInTheDocument();
    expect(screen.getByText("Option b")).toBeInTheDocument();
  });

  it("drops empty segments produced by stray commas", () => {
    renderWithMantine(<McqAnswerView {...baseProps({ answer: "a,,b" })} />);
    expect(screen.getAllByText(/^Option /)).toHaveLength(2);
  });

  it("shows a no-selection note when the answer is empty", () => {
    renderWithMantine(<McqAnswerView {...baseProps()} />);
    expect(screen.getByText("(no selection)")).toBeInTheDocument();
    expect(screen.queryByText(/^Option /)).not.toBeInTheDocument();
  });

  it("shows the question name in the preview header", () => {
    renderWithMantine(<McqAnswerView {...baseProps({ answer: "a", questionName: "mc-99" })} />);
    expect(screen.getByText("mc-99")).toBeInTheDocument();
  });

  it("renders stored zero-based indexes as option letters", () => {
    renderWithMantine(<McqAnswerView {...baseProps({ answer: "0,1,26" })} />);
    expect(screen.getByText("Option A")).toBeInTheDocument();
    expect(screen.getByText("Option B")).toBeInTheDocument();
    expect(screen.getByText("Option AA")).toBeInTheDocument();
  });

  it("preserves legacy non-numeric option values", () => {
    renderWithMantine(<McqAnswerView {...baseProps({ answer: "a" })} />);
    expect(screen.getByText("Option a")).toBeInTheDocument();
  });
});
