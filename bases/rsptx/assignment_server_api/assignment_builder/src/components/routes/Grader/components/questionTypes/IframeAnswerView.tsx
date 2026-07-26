import React, { useEffect, useMemo, useRef } from "react";

import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";

import styles from "./AnswerViews.module.css";
import { QuestionPreviewHeader } from "./RunestonePreview";
import { AnswerRendererProps } from "./types";

/**
 * The part of the Runestone SPLICE wrapper the grader talks to. The wrapper is
 * a singleton created by the Runestone bundle, which the page loads
 * asynchronously, so it may not exist yet when this view mounts.
 */
interface SpliceGraderApi {
  registerGraderFrame: (frame: HTMLIFrameElement, state: unknown) => void;
  unregisterGraderFrame: (frame: HTMLIFrameElement) => void;
}

const getSpliceWrapper = (): SpliceGraderApi | undefined =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).spliceWrapper;

const WRAPPER_POLL_MS = 100;
const WRAPPER_TIMEOUT_MS = 5000;

/**
 * Resolve once the Runestone bundle has created the SPLICE wrapper, or with
 * undefined if it never turns up. We wait because the activity asks for its
 * saved state as soon as it loads: registering after that request would leave
 * the instructor looking at an empty activity.
 */
const waitForSpliceWrapper = (): Promise<SpliceGraderApi | undefined> => {
  const existing = getSpliceWrapper();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let waited = 0;
    const timer = setInterval(() => {
      const wrapper = getSpliceWrapper();
      waited += WRAPPER_POLL_MS;
      if (wrapper || waited >= WRAPPER_TIMEOUT_MS) {
        clearInterval(timer);
        resolve(wrapper);
      }
    }, WRAPPER_POLL_MS);
  });
};

interface FrameSpec {
  src: string;
  style: string;
}

/**
 * Pull the embedded activity out of a question's stored htmlsrc. These question
 * types are a wrapper div around a single iframe, so we rebuild the iframe
 * ourselves rather than injecting the html: that lets us register the frame
 * with the SPLICE wrapper *before* it starts loading.
 */
export const extractFrameSpec = (htmlsrc?: string): FrameSpec | null => {
  if (!htmlsrc) return null;
  const doc = new DOMParser().parseFromString(htmlsrc, "text/html");
  const frame = doc.querySelector("iframe");
  const src = frame?.getAttribute("src");
  if (!frame || !src) return null;
  return { src, style: frame.getAttribute("style") ?? "" };
};

/** Pretty-print a stored state blob for the raw-data disclosure. */
const formatState = (state: unknown): string => {
  if (state == null || state === "") return "(no state recorded)";
  if (typeof state === "string") return state;
  try {
    return JSON.stringify(state, null, 2);
  } catch {
    return String(state);
  }
};

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
