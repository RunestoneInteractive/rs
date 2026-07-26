import React from "react";

import { renderWithMantine, screen, waitFor } from "@/test/renderWithMantine";
import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";

import { extractFrameSpec, IframeAnswerView } from "./IframeAnswerView";
import { AnswerRendererProps } from "./types";

const DOENET_HTMLSRC = `
<div class="ptx-runestone-container">
  <div class="runestone dualquestion_section">
    <div data-component="dual">
      <div data-component="doenet" id="PTXSB_2_doenet-velocity">
        <iframe id="doenet-velocity" style="width:600px; height:600px; display: block;"
                src="/ns/books/published/PTXSB/doenet-velocity-if.html"></iframe>
      </div>
    </div>
  </div>
</div>`;

const history: GraderAnswerHistoryItem[] = [
  { id: 10, answer: { cid: "first" }, percent: 0 },
  { id: 11, answer: { cid: "second" }, percent: 1 }
];

const baseProps = (overrides: Partial<AnswerRendererProps> = {}): AnswerRendererProps => ({
  answer: "",
  history,
  questionName: "PTXSB_2_doenet-velocity",
  questionId: 180,
  sid: "testuser1",
  htmlsrc: DOENET_HTMLSRC,
  ...overrides
});

const register = vi.fn();
const unregister = vi.fn();

const frameIn = (container: HTMLElement) => container.querySelector("iframe");

describe("extractFrameSpec", () => {
  it("pulls the src and style off the embedded iframe", () => {
    expect(extractFrameSpec(DOENET_HTMLSRC)).toEqual({
      src: "/ns/books/published/PTXSB/doenet-velocity-if.html",
      style: "width:600px; height:600px; display: block;"
    });
  });

  it("returns null when there is no iframe to embed", () => {
    expect(extractFrameSpec("<div>no activity here</div>")).toBeNull();
  });

  it("returns null for an iframe with no src", () => {
    expect(extractFrameSpec("<div><iframe></iframe></div>")).toBeNull();
  });

  it("returns null when there is no htmlsrc at all", () => {
    expect(extractFrameSpec(undefined)).toBeNull();
  });
});

describe("IframeAnswerView", () => {
  beforeEach(() => {
    register.mockClear();
    unregister.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).spliceWrapper = {
      registerGraderFrame: register,
      unregisterGraderFrame: unregister
    };
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).spliceWrapper;
  });

  it("registers the frame with the selected attempt's state before loading it", async () => {
    const { container } = renderWithMantine(
      <IframeAnswerView {...baseProps({ activeAttemptIndex: 0 })} />
    );

    await waitFor(() => expect(register).toHaveBeenCalled());

    const frame = frameIn(container);

    expect(register).toHaveBeenCalledWith(frame, { cid: "first" });
    await waitFor(() =>
      expect(frameIn(container)?.getAttribute("src")).toBe(
        "/ns/books/published/PTXSB/doenet-velocity-if.html"
      )
    );
  });

  it("falls back to the latest attempt when no attempt is selected", async () => {
    renderWithMantine(<IframeAnswerView {...baseProps()} />);

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(expect.anything(), { cid: "second" })
    );
  });

  it("unregisters the frame when the view goes away", async () => {
    const { unmount } = renderWithMantine(
      <IframeAnswerView {...baseProps({ activeAttemptIndex: 1 })} />
    );

    await waitFor(() => expect(register).toHaveBeenCalled());
    unmount();

    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it("shows the raw state so an instructor can still inspect it", () => {
    renderWithMantine(<IframeAnswerView {...baseProps({ activeAttemptIndex: 0 })} />);

    expect(screen.getByText("Raw saved state")).toBeInTheDocument();
    expect(screen.getByText(/"cid": "first"/)).toBeInTheDocument();
  });

  it("does not embed before the attempt history arrives", async () => {
    // Embedding with no state and tearing it down once the history lands is a
    // wasted load of a heavy third-party activity.
    const { container, rerender } = renderWithMantine(
      <IframeAnswerView {...baseProps({ history: [], activeAttemptIndex: -1 })} />
    );

    expect(screen.getByText(/No saved work to show/)).toBeInTheDocument();
    expect(frameIn(container)).toBeNull();
    expect(register).not.toHaveBeenCalled();

    rerender(<IframeAnswerView {...baseProps({ activeAttemptIndex: 1 })} />);

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith(expect.anything(), { cid: "second" });
  });

  it("explains itself instead of embedding when the question has no iframe", () => {
    const { container } = renderWithMantine(
      <IframeAnswerView {...baseProps({ htmlsrc: "<div>nothing embeddable</div>" })} />
    );

    expect(screen.getByText(/No embedded activity available/)).toBeInTheDocument();
    expect(frameIn(container)).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });
});
