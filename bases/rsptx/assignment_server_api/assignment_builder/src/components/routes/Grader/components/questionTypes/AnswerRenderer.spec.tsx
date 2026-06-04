import React from "react";

import { renderWithMantine, screen } from "@/test/renderWithMantine";
import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";

import { AnswerRenderer } from "./AnswerRenderer";
import { AnswerRendererProps } from "./types";

vi.mock("./McqAnswerView", () => ({ McqAnswerView: () => <div>VIEW:MCQ</div> }));
vi.mock("./FitbAnswerView", () => ({ FitbAnswerView: () => <div>VIEW:FITB</div> }));
vi.mock("./ShortAnswerView", () => ({ ShortAnswerView: () => <div>VIEW:SHORT</div> }));
vi.mock("./ParsonsAnswerView", () => ({ ParsonsAnswerView: () => <div>VIEW:PARSONS</div> }));
vi.mock("./ActiveCodeAnswerView", () => ({
  ActiveCodeAnswerView: () => <div>VIEW:ACTIVECODE</div>
}));
vi.mock("./DefaultAnswerView", () => ({ DefaultAnswerView: () => <div>VIEW:DEFAULT</div> }));
vi.mock("./RunestoneGraderPreview", () => ({
  RunestoneGraderPreview: ({ attemptId }: { attemptId?: string | number }) => (
    <div>PREVIEW:{String(attemptId)}</div>
  )
}));

const baseProps = (overrides: Partial<AnswerRendererProps> = {}): AnswerRendererProps => ({
  answer: "a",
  history: [],
  questionName: "q-div-1",
  questionId: 7,
  sid: "student1",
  ...overrides
});

const renderFor = (questionType: string, overrides: Partial<AnswerRendererProps> = {}) =>
  renderWithMantine(<AnswerRenderer questionType={questionType} {...baseProps(overrides)} />);

describe("AnswerRenderer dispatch (no interactive htmlsrc)", () => {
  it.each(["mchoice", "clickablearea", "dragndrop"])(
    "routes %s to the MCQ view",
    (questionType) => {
      renderFor(questionType);
      expect(screen.getByText("VIEW:MCQ")).toBeInTheDocument();
    }
  );

  it("routes fillintheblank to the FITB view", () => {
    renderFor("fillintheblank");
    expect(screen.getByText("VIEW:FITB")).toBeInTheDocument();
  });

  it("routes shortanswer to the short-answer view", () => {
    renderFor("shortanswer");
    expect(screen.getByText("VIEW:SHORT")).toBeInTheDocument();
  });

  it("routes parsonsprob to the Parsons view", () => {
    renderFor("parsonsprob");
    expect(screen.getByText("VIEW:PARSONS")).toBeInTheDocument();
  });

  it.each(["activecode", "codelens", "actex"])(
    "routes %s to the ActiveCode view",
    (questionType) => {
      renderFor(questionType);
      expect(screen.getByText("VIEW:ACTIVECODE")).toBeInTheDocument();
    }
  );

  it("routes an unknown question type to the default view", () => {
    renderFor("totally-unknown");
    expect(screen.getByText("VIEW:DEFAULT")).toBeInTheDocument();
  });
});

describe("AnswerRenderer interactive Runestone preview", () => {
  it("renders the Runestone preview instead of a plain view when htmlsrc is present for a supported type", () => {
    renderFor("mchoice", { htmlsrc: "<div>q</div>" });

    expect(screen.getByText("PREVIEW:latest")).toBeInTheDocument();
    expect(screen.queryByText("VIEW:MCQ")).not.toBeInTheDocument();
  });

  it("ignores htmlsrc for an unsupported type and falls back to the default view", () => {
    renderFor("totally-unknown", { htmlsrc: "<div>q</div>" });

    expect(screen.getByText("VIEW:DEFAULT")).toBeInTheDocument();
    expect(screen.queryByText(/^PREVIEW:/)).not.toBeInTheDocument();
  });

  it("passes the selected non-latest attempt id to the preview", () => {
    const history: GraderAnswerHistoryItem[] = [
      { id: 101, answer: "a" },
      { id: 102, answer: "b" },
      { id: 103, answer: "c" }
    ];

    renderFor("mchoice", { htmlsrc: "<div>q</div>", history, activeAttemptIndex: 0 });

    expect(screen.getByText("PREVIEW:101")).toBeInTheDocument();
  });

  it("treats the latest attempt index as the live attempt", () => {
    const history: GraderAnswerHistoryItem[] = [
      { id: 101, answer: "a" },
      { id: 102, answer: "b" },
      { id: 103, answer: "c" }
    ];

    renderFor("mchoice", { htmlsrc: "<div>q</div>", history, activeAttemptIndex: 2 });

    expect(screen.getByText("PREVIEW:latest")).toBeInTheDocument();
  });
});
