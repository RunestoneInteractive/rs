import { renderWithMantine, screen } from "@/test/renderWithMantine";

import { ActiveCodeAnswerView } from "./ActiveCodeAnswerView";
import { DefaultAnswerView } from "./DefaultAnswerView";
import { FitbAnswerView } from "./FitbAnswerView";
import { McqAnswerView } from "./McqAnswerView";
import { ParsonsAnswerView } from "./ParsonsAnswerView";
import { ShortAnswerView } from "./ShortAnswerView";
import { AnswerRendererProps } from "./types";

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
    renderWithMantine(<McqAnswerView {...baseProps({ answer: "" })} />);

    expect(screen.getByText("(no selection)")).toBeInTheDocument();
    expect(screen.queryByText(/^Option /)).not.toBeInTheDocument();
  });

  it("shows the question name in the preview header", () => {
    renderWithMantine(<McqAnswerView {...baseProps({ answer: "a", questionName: "mc-99" })} />);

    expect(screen.getByText("mc-99")).toBeInTheDocument();
  });
});

describe("FitbAnswerView", () => {
  it("renders one blank per element of a JSON array answer", () => {
    renderWithMantine(<FitbAnswerView {...baseProps({ answer: '["foo", "bar"]' })} />);

    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
  });

  it("wraps a non-array JSON scalar in a single blank", () => {
    renderWithMantine(<FitbAnswerView {...baseProps({ answer: "5" })} />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("falls back to comma splitting for non-JSON answers", () => {
    renderWithMantine(<FitbAnswerView {...baseProps({ answer: "p,q" })} />);

    expect(screen.getByText("p")).toBeInTheDocument();
    expect(screen.getByText("q")).toBeInTheDocument();
  });

  it("renders an empty marker for a blank answer", () => {
    renderWithMantine(<FitbAnswerView {...baseProps({ answer: "" })} />);

    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });

  it("labels individual empty blanks within a filled array", () => {
    renderWithMantine(<FitbAnswerView {...baseProps({ answer: '["", "x"]' })} />);

    expect(screen.getByText("(empty)")).toBeInTheDocument();
    expect(screen.getByText("x")).toBeInTheDocument();
  });
});

describe("ShortAnswerView", () => {
  it("renders the student response text", () => {
    renderWithMantine(<ShortAnswerView {...baseProps({ answer: "My essay." })} />);

    expect(screen.getByText("Student response")).toBeInTheDocument();
    expect(screen.getByText("My essay.")).toBeInTheDocument();
  });

  it("renders an empty-response marker when there is no answer", () => {
    renderWithMantine(<ShortAnswerView {...baseProps({ answer: "" })} />);

    expect(screen.getByText("(empty response)")).toBeInTheDocument();
  });
});

describe("ParsonsAnswerView", () => {
  it("splits a dash-joined answer into ordered blocks with a count", () => {
    renderWithMantine(<ParsonsAnswerView {...baseProps({ answer: "one - two - three" })} />);

    expect(screen.getByText("Reconstructed block order (3)")).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
    expect(screen.getByText("three")).toBeInTheDocument();
  });

  it("shows a zero count and a no-blocks note for an empty answer", () => {
    renderWithMantine(<ParsonsAnswerView {...baseProps({ answer: "" })} />);

    expect(screen.getByText("Reconstructed block order (0)")).toBeInTheDocument();
    expect(screen.getByText("(no blocks submitted)")).toBeInTheDocument();
  });
});

describe("ActiveCodeAnswerView", () => {
  it("renders the submitted source", () => {
    renderWithMantine(<ActiveCodeAnswerView {...baseProps({ answer: "x = 1" })} />);

    expect(screen.getByText("Submitted source")).toBeInTheDocument();
    expect(screen.getByText("x = 1")).toBeInTheDocument();
  });

  it("renders an empty marker when no source was submitted", () => {
    renderWithMantine(<ActiveCodeAnswerView {...baseProps({ answer: "" })} />);

    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });
});

describe("DefaultAnswerView", () => {
  it("renders the raw answer under a generic heading", () => {
    renderWithMantine(<DefaultAnswerView {...baseProps({ answer: "raw-value" })} />);

    expect(screen.getByText("Student answer")).toBeInTheDocument();
    expect(screen.getByText("raw-value")).toBeInTheDocument();
  });

  it("renders an empty marker for a blank answer", () => {
    renderWithMantine(<DefaultAnswerView {...baseProps({ answer: "" })} />);

    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });
});
