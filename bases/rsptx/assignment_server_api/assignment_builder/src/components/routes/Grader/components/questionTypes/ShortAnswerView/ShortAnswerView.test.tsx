import { describe, expect, it } from "vitest";

import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { AnswerRendererProps } from "../types";

import { ShortAnswerView } from "./ShortAnswerView";
const baseProps = (answer: string): AnswerRendererProps => ({
  answer,
  history: [],
  questionName: "q-div-1",
  questionId: 7,
  sid: "student1"
});

describe("ShortAnswerView", () => {
  it("renders the student response text", () => {
    renderWithMantine(<ShortAnswerView {...baseProps("My essay.")} />);

    expect(screen.getByText("Student response")).toBeInTheDocument();
    expect(screen.getByText("My essay.")).toBeInTheDocument();
  });

  it("renders an empty-response marker when there is no answer", () => {
    renderWithMantine(<ShortAnswerView {...baseProps("")} />);

    expect(screen.getByText("(empty response)")).toBeInTheDocument();
  });
});
