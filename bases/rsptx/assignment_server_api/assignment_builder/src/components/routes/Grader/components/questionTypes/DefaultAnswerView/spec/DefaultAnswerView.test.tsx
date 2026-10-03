import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { AnswerRendererProps } from "../../types";
import { DefaultAnswerView } from "../DefaultAnswerView";

const baseProps = (answer: string): AnswerRendererProps => ({
  answer,
  history: [],
  questionName: "q-div-1",
  questionId: 7,
  sid: "student1"
});

describe("DefaultAnswerView", () => {
  it("renders the raw answer under a generic heading", () => {
    renderWithMantine(<DefaultAnswerView {...baseProps("raw-value")} />);

    expect(screen.getByText("Student answer")).toBeInTheDocument();
    expect(screen.getByText("raw-value")).toBeInTheDocument();
  });

  it("renders an empty marker for a blank answer", () => {
    renderWithMantine(<DefaultAnswerView {...baseProps("")} />);

    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });
});
