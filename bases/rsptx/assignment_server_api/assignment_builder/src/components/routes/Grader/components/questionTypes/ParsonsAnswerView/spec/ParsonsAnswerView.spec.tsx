import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { AnswerRendererProps } from "../../types";
import { ParsonsAnswerView } from "../ParsonsAnswerView";

const htmlsrc = `<div data-component="parsons">
  <pre class="parsonsblocks">
def greet(name):
---
    if name:
---
        print(f"Hello, {name}")
  </pre>
</div>`;

const baseProps = (answer: string): AnswerRendererProps => ({
  answer,
  history: [],
  htmlsrc,
  questionName: "q-div-1",
  questionId: 7,
  sid: "student1"
});

describe("ParsonsAnswerView", () => {
  it("renders the student's arranged blocks as plain source code", () => {
    renderWithMantine(<ParsonsAnswerView {...baseProps("0_0-1_1-2_2")} />);

    expect(screen.getByText("Submitted source")).toBeInTheDocument();
    expect(screen.getByText(/def greet\(name\):/)).toHaveTextContent(
      'def greet(name): if name: print(f"Hello, {name}")'
    );
    expect(screen.queryByText(/Reconstructed block order/)).not.toBeInTheDocument();
  });

  it("renders an empty marker when no blocks were submitted", () => {
    renderWithMantine(<ParsonsAnswerView {...baseProps("-")} />);

    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });

  it("does not expose a hash when the question source is unavailable", () => {
    renderWithMantine(<ParsonsAnswerView {...baseProps("0_0")} htmlsrc={undefined} />);

    expect(screen.getByText("Stored answer could not be reconstructed.")).toBeInTheDocument();
    expect(screen.queryByText("0_0")).not.toBeInTheDocument();
  });
});
