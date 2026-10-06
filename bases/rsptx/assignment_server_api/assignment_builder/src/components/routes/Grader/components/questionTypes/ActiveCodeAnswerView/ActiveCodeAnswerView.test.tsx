import { describe, expect, it } from "vitest";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { AnswerRendererProps } from "../types";

import { ActiveCodeAnswerView } from "./ActiveCodeAnswerView";

const baseProps = (answer: string): AnswerRendererProps => ({
  answer,
  history: [],
  questionName: "q-div-1",
  questionId: 7,
  sid: "student1"
});

describe("ActiveCodeAnswerView", () => {
  it("renders the submitted source", () => {
    renderWithMantine(<ActiveCodeAnswerView {...baseProps("x = 1")} />);

    expect(screen.getByText("Submitted source")).toBeInTheDocument();
    expect(screen.getByText("x = 1")).toBeInTheDocument();
  });

  it("renders an empty marker when no source was submitted", () => {
    renderWithMantine(<ActiveCodeAnswerView {...baseProps("")} />);

    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });
});
