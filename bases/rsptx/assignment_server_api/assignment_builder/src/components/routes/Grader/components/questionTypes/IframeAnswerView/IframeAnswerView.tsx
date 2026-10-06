import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";
import React, { useEffect, useMemo, useRef } from "react";

import styles from "../AnswerViews.module.css";
import { QuestionPreviewHeader } from "../RunestonePreview";
import { AnswerRendererProps } from "../types";

import { extractFrameSpec, formatState, getSpliceWrapper, waitForSpliceWrapper } from "./utils";

/**
 * Read-only view for question types that are a third-party activity in an
 * iframe -- splice, doenet, and the builder's iframe type. Their stored answer
 * is an opaque provider state blob, so instead of printing it we re-embed the
 * activity and hand it the selected attempt's state through the SPLICE
 * protocol, which makes it display the student's own work.
 */
export const IframeAnswerView: React.FC<AnswerRendererProps & { questionType?: string }> = (
  props
) => {
  const { htmlsrc, questionName, sid, history, activeAttemptIndex, answer } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);

  const spec = useMemo(() => extractFrameSpec(htmlsrc), [htmlsrc]);

  const attempt: GraderAnswerHistoryItem | undefined =
    (typeof activeAttemptIndex === "number" && activeAttemptIndex >= 0
      ? history[activeAttemptIndex]
      : undefined) ?? history[history.length - 1];

  const state = attempt?.answer;
  const attemptId = attempt?.id;

  useEffect(() => {
    const host = hostRef.current;
    // Nothing to embed until we know which attempt we are replaying: the
    // history arrives a moment after the pane mounts, and loading the activity
    // twice just to throw the first one away is pure waste.

    if (!host || !spec || attemptId === undefined) return;

    const frame = document.createElement("iframe");

    frame.setAttribute("style", spec.style);
    frame.className = styles.activityFrame;
    frame.title = `${questionName} activity submitted by ${sid}`;
    host.replaceChildren(frame);

    let cancelled = false;
    let registered = false;

    waitForSpliceWrapper().then((wrapper) => {
      if (cancelled) return;
      if (wrapper) {
        wrapper.registerGraderFrame(frame, state);
        registered = true;
      }
      // Load the activity even without the wrapper; it will come up empty
      // rather than not at all, and the raw state is still shown below.
      frame.src = spec.src;
    });

    return () => {
      cancelled = true;
      if (registered) {
        getSpliceWrapper()?.unregisterGraderFrame(frame);
      }
      host.replaceChildren();
    };
    // `state` is deliberately not a dependency: it is keyed by attemptId, and a
    // fresh object identity on every render would reload the activity endlessly.
  }, [spec, attemptId, sid, questionName]); // eslint-disable-line

  return (
    <div>
      <QuestionPreviewHeader {...props} />

      {!spec && (
        <div className={styles.emptyPreview}>No embedded activity available for this question.</div>
      )}
      {spec && attemptId === undefined && (
        <div className={styles.emptyPreview}>No saved work to show for this student.</div>
      )}
      {spec && attemptId !== undefined && (
        <>
          <div className={styles.mutedNote}>
            Showing this student&rsquo;s saved work. Nothing you do here is recorded.
          </div>
          <div ref={hostRef} className={styles.activityFrameHost} />
        </>
      )}

      <details className={styles.rawStateDetails}>
        <summary className={styles.rawStateSummary}>Raw saved state</summary>
        <pre className={styles.codeBlock}>{formatState(state ?? answer)}</pre>
      </details>
    </div>
  );
};
