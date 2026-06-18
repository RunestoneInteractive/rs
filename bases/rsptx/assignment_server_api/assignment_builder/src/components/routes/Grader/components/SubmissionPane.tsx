import { Slider } from "@mantine/core";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import {
  GraderAnswerHistoryItem,
  GraderStudentAnswer,
  useGetGraderHistoryQuery
} from "@store/grader/grader.logic.api";

import styles from "../Grader.module.css";
import { getDemoHistoryFor } from "../tour/graderDemoData";
import { useGraderTourContext } from "../tour/GraderTourContext";
import { AnswerRenderer } from "./questionTypes/AnswerRenderer";
import { CorrectChipKind, correctChipKind, formatAnswer } from "./submissionPaneHelpers";

interface Props {
  assignmentId: number;
  questionId: number;
  questionName: string;
  questionType: string;
  htmlsrc?: string;
  student: GraderStudentAnswer;
}

export interface SubmissionPaneHandle {
  prevAttempt: () => void;

  nextAttempt: () => void;
}

const CHIP_CLASS: Record<CorrectChipKind, string> = {
  correct: styles.chipCorrect,
  partial: styles.chipPartial,
  wrong: styles.chipWrong
};

const correctChip = (
  h: Pick<GraderAnswerHistoryItem, "correct" | "percent">
): { label: string; cls: string } | null => {
  const kind = correctChipKind(h);
  return kind ? { label: kind, cls: CHIP_CLASS[kind] } : null;
};

export const SubmissionPane = forwardRef<SubmissionPaneHandle, Props>(function SubmissionPane(
  { assignmentId, questionId, questionName, questionType, htmlsrc, student },
  ref
) {
  const { isDemo } = useGraderTourContext();
  const { data: historyData } = useGetGraderHistoryQuery(
    { assignmentId, questionId, sid: student.sid },
    { skip: isDemo }
  );

  const history: GraderAnswerHistoryItem[] = isDemo
    ? getDemoHistoryFor(student.sid).history
    : (historyData?.history ?? []);

  const [activeAttempt, setActiveAttempt] = useState<number>(-1);

  useEffect(() => {
    setActiveAttempt(history.length ? history.length - 1 : -1);
  }, [student.sid, history.length]);

  const currentAnswer = useMemo(
    () => (activeAttempt >= 0 && history[activeAttempt]) || null,
    [activeAttempt, history]
  );

  const displayedAnswer = formatAnswer(currentAnswer?.answer ?? student.answer ?? "");
  const chip = correctChip(currentAnswer ?? student);
  const totalAttempts = history.length;
  const isLatest = activeAttempt === totalAttempts - 1;

  const goPrevAttempt = () => setActiveAttempt((i) => Math.max(0, i - 1));
  const goNextAttempt = () => setActiveAttempt((i) => Math.min(totalAttempts - 1, i + 1));

  useImperativeHandle(
    ref,
    () => ({
      prevAttempt: goPrevAttempt,
      nextAttempt: goNextAttempt
    }),

    [totalAttempts]
  );

  return (
    <div className={styles.submissionPane} data-tour="grader-preview-pane">
      <div className={styles.attemptBar} data-tour="grader-history">
        <div className={styles.attemptBarRow}>
          <span className={styles.attemptLabel}>
            <Icon name="history" size={14} />
            <strong>
              {totalAttempts > 0
                ? `Attempt ${activeAttempt + 1} of ${totalAttempts}`
                : "No attempts"}
            </strong>
            {isLatest && totalAttempts > 1 && <span className={styles.latestBadge}>latest</span>}
          </span>
          {chip && <span className={`${styles.chip} ${chip.cls}`}>{chip.label}</span>}
          {currentAnswer?.timestamp && (
            <span className={styles.attemptTimestamp}>
              {new Date(currentAnswer.timestamp).toLocaleString()}
            </span>
          )}
          <span className={styles.spacer} />
          <button
            type="button"
            className={styles.attemptStepBtn}
            onClick={goPrevAttempt}
            disabled={activeAttempt <= 0}
            aria-label="Previous attempt"
            title="Previous attempt"
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <button
            type="button"
            className={styles.attemptStepBtn}
            onClick={goNextAttempt}
            disabled={activeAttempt >= totalAttempts - 1}
            aria-label="Next attempt"
            title="Next attempt"
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
        {totalAttempts > 1 && (
          <Slider
            value={activeAttempt}
            onChange={setActiveAttempt}
            min={0}
            max={totalAttempts - 1}
            step={1}
            className={styles.attemptSlider}
          />
        )}
      </div>

      <div className={styles.submissionRenderer}>
        <AnswerRenderer
          questionType={questionType}
          htmlsrc={htmlsrc}
          answer={displayedAnswer}
          correct={currentAnswer?.correct ?? student.correct}
          percent={currentAnswer?.percent ?? student.percent}
          history={history}
          questionName={questionName}
          questionId={questionId}
          sid={student.sid}
          activeAttemptIndex={activeAttempt}
        />
      </div>

      {totalAttempts > 0 && (
        <details className={styles.attemptDetails} open={totalAttempts <= 3}>
          <summary className={styles.attemptSummary}>
            <Icon name="list" size={14} /> All attempts ({totalAttempts})
          </summary>
          <div className={styles.attemptList}>
            {history.map((h, idx) => {
              const c = correctChip(h);
              const active = idx === activeAttempt;
              const raw = formatAnswer(h.answer);
              return (
                <button
                  type="button"
                  key={h.id}
                  className={`${styles.historyItem} ${active ? styles.active : ""}`}
                  onClick={() => setActiveAttempt(idx)}
                  title={h.timestamp || ""}
                >
                  <div className={styles.historyMeta}>
                    <strong>#{idx + 1}</strong>
                    {h.timestamp && <span>{new Date(h.timestamp).toLocaleString()}</span>}
                    {c && <span className={`${styles.chip} ${c.cls}`}>{c.label}</span>}
                    {idx === totalAttempts - 1 && totalAttempts > 1 && (
                      <span className={styles.latestBadge}>latest</span>
                    )}
                  </div>
                  <div className={styles.historyAnswer}>
                    {raw.slice(0, 200) || "(empty)"}
                    {raw.length > 200 ? "…" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
});
