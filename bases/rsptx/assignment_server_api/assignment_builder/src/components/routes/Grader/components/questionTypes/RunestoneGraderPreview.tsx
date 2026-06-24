import { MathJaxWrapper } from "@components/routes/AssignmentBuilder/MathJaxWrapper";
import { MathJax } from "better-react-mathjax";
import React, { useEffect, useReducer, useRef } from "react";

import { renderRunestoneComponent } from "@/componentFuncs";
import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";

import styles from "./AnswerViews.module.css";

interface Props {
  htmlsrc?: string;
  divId: string;
  sid: string;

  attempt?: GraderAnswerHistoryItem | null;

  attemptId?: number | string;

  deadline?: string;
}

export const RunestoneGraderPreview: React.FC<Props> = ({
  htmlsrc,
  divId,
  sid,
  attempt,
  deadline
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (!ref.current || !htmlsrc) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = (window as any).eBookConfig || {};
      if (cfg.email && cfg.course) {
        localStorage.removeItem(`${cfg.email}:${cfg.course}:${divId}-given`);
      }
    } catch {}

    ref.current.innerHTML = htmlsrc;

    const useFetch = !attempt;
    const opts: Record<string, unknown> = {
      graderactive: true,
      graderMode: true,
      suppressFlagForReview: true,
      sid,

      assessmentTaken: useFetch,
      useRunestoneServices: true,
      gradingContainer: ref.current.id || undefined
    };
    if (deadline) {
      opts.deadline = deadline;
      opts.enforceDeadline = true;
      opts.rawdeadline = deadline;
      opts.tzoff = new Date().getTimezoneOffset() / 60;
    }

    let cancelled = false;
    renderRunestoneComponent(ref, opts)
      .then(async () => {
        if (cancelled) return;
        forceUpdate();
        if (useFetch) return;

        const cmKey = (opts.gradingContainer ? `${opts.gradingContainer} ` : "") + divId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const componentMap = (window as any).componentMap || {};
        const inst = componentMap[cmKey] || componentMap[divId];
        if (!inst) return;
        try {
          if (typeof inst.checkServerComplete?.then === "function") {
            await inst.checkServerComplete;
          }

          if (inst.addingScrubber) {
            for (let i = 0; i < 50 && inst.addingScrubber; i++) {
              await new Promise((r) => setTimeout(r, 20));
            }
          }
          if (cancelled) return;

          const rawAnswer = attempt!.answer;
          const codeString =
            typeof rawAnswer === "string"
              ? rawAnswer
              : rawAnswer == null
                ? ""
                : (() => {
                    try {
                      return JSON.stringify(rawAnswer);
                    } catch {
                      return String(rawAnswer);
                    }
                  })();

          const isCodeEditor = inst.editor && typeof inst.editor.setValue === "function";

          if (isCodeEditor && (!inst.restoreAnswers || attempt!.source === "code_table")) {
            inst.editor.acEditEvent = false;
            inst.editor.setValue(codeString);
            if (typeof inst.setLockedRegions === "function") {
              try {
                inst.setLockedRegions();
              } catch {}
            }
            if (typeof inst.setHighlightLines === "function") {
              try {
                inst.setHighlightLines();
              } catch {}
            }

            try {
              if (Array.isArray(inst.history) && inst.history.length) {
                const idx = inst.history.findIndex((h: string) => h === codeString);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const $ = (window as any).$;
                if (idx >= 0 && $ && inst.scrubber) {
                  $(inst.scrubber).slider("value", idx);
                  if (typeof inst.slideit === "function") {
                    try {
                      inst.slideit(null);
                    } catch {}
                  }
                }
              }
            } catch {
              /* noop */
            }
            inst.attempted = true;
          } else if (typeof inst.restoreAnswers === "function") {
            inst.restoreAnswers({
              answer: rawAnswer ?? "",
              correct: attempt!.correct ?? null,
              percent: attempt!.percent ?? null,
              timestamp: attempt!.timestamp,
              sid
            });
            inst.attempted = true;
            if (typeof inst.decorateStatus === "function") {
              inst.decorateStatus();
            }
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[RunestoneGraderPreview] restore failed", err);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [htmlsrc, sid, divId, attempt?.id]);

  if (!htmlsrc) {
    return <div className={styles.emptyPreview}>No rendered question preview available.</div>;
  }

  const hostId = `grader-preview-${divId}-${sid}-${attempt?.id ?? "latest"}`;

  return (
    <MathJaxWrapper>
      <MathJax>
        <style>
          {`
            .ptx-runestone-container .CodeMirror-scroll {
              max-height: none !important;
            }
            .ptx-runestone-container .CodeMirror {
              height: auto !important;
            }
            .ptx-runestone-container table {
              border-collapse: collapse;
              margin: 1rem 0;
              width: 100%;
              table-layout: fixed;
            }
            .ptx-runestone-container th,
            .ptx-runestone-container td {
              border: 1px solid var(--rs-border-solid);
              padding: 0.5rem;
              vertical-align: top;
              min-width: 100px;
            }
            .ptx-runestone-container th {
              background: var(--rs-neutral-50);
              font-weight: 600;
              text-align: left;
            }
          `}
        </style>
        <div className="ptx-runestone-container runestone relative flex justify-content-center w-full">
          <div className="flex justify-content-center" style={{ width: "100%" }}>
            <div ref={ref} id={hostId} className="text-left mx-auto" style={{ width: "100%" }} />
          </div>
        </div>
      </MathJax>
    </MathJaxWrapper>
  );
};

export default RunestoneGraderPreview;
