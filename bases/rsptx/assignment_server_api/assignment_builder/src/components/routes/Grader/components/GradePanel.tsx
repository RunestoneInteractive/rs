import { Button, NumberInput, Switch, Textarea, Tooltip } from "@mantine/core";
import React, { forwardRef, useImperativeHandle, useRef } from "react";

import { Icon } from "@/components/ui/Icon";
import { GraderStudentAnswer } from "@store/grader/grader.logic.api";

import { AutoSaveStatus } from "../hooks/useAutoSaveGrade";
import styles from "../Grader.module.css";
import { SaveStatusPill } from "./SaveStatusPill";

interface Props {
  student?: GraderStudentAnswer | null;
  maxPoints: number;
  score: number;
  comment: string;
  status: AutoSaveStatus;
  errorMessage?: string;
  hasPrev: boolean;
  hasNext: boolean;
  positionLabel?: string;

  disabled?: boolean;
  onScoreChange: (n: number) => void;
  onCommentChange: (s: string) => void;
  onCommentBlur: () => void;
  onScoreBlur: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRetry: () => void;

  autoAdvance?: boolean;
  onAutoAdvanceChange?: (value: boolean) => void;
}

export interface GradePanelHandle {
  focusGrade: () => void;
  focusComment: () => void;
}

export const GradePanel = forwardRef<GradePanelHandle, Props>(function GradePanel(props, ref) {
  const {
    student,
    maxPoints,
    score,
    comment,
    status,
    errorMessage,
    hasPrev,
    hasNext,
    positionLabel,
    disabled,
    onScoreChange,
    onCommentChange,
    onCommentBlur,
    onScoreBlur,
    onPrev,
    onNext,
    onRetry,
    autoAdvance,
    onAutoAdvanceChange
  } = props;

  const scoreInputRef = useRef<HTMLInputElement | null>(null);
  const commentRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => ({
    focusGrade: () => scoreInputRef.current?.focus(),
    focusComment: () => commentRef.current?.focus()
  }));

  const isDisabled = disabled || !student;
  const studentName = student
    ? `${student.first_name || ""} ${student.last_name || ""}`.trim() || student.sid
    : "No student selected";

  return (
    <div className={styles.gradePane} data-tour="grader-grade-panel">
      <div className={styles.gradePaneHeader}>
        <Icon name="user" size={18} className={styles.gradePaneAvatar} />
        <div className={styles.gradePaneIdentity}>
          <div className={styles.gradePaneName}>{studentName}</div>
          <div className={styles.gradePaneMeta}>
            {student ? (
              <>
                <span className="mono">{student.sid}</span>
                <span>
                  {" "}
                  · {student.attempts} attempt{student.attempts === 1 ? "" : "s"}
                </span>
                {positionLabel && <span> · {positionLabel}</span>}
              </>
            ) : (
              <span>No submissions for this question</span>
            )}
          </div>
        </div>
        <SaveStatusPill status={status} onRetry={onRetry} errorMessage={errorMessage} />
      </div>

      {onAutoAdvanceChange && (
        <label
          data-tour="grader-auto-advance"
          className={styles.autoAdvanceToggle}
          title="When on, jumps to the next ungraded student a moment after saving. You can always undo from the toast."
        >
          <Switch
            checked={!!autoAdvance}
            onChange={(e) => onAutoAdvanceChange(e.currentTarget.checked)}
            size="xs"
          />
          <Icon name="forward" />
          <span>Auto-advance after save</span>
        </label>
      )}

      <div className={styles.gradePaneNav}>
        <Tooltip label="Previous student (K)" position="bottom">
          <Button
            leftSection={<Icon name="chevron-left" size={14} />}
            variant="default"
            onClick={onPrev}
            disabled={!hasPrev}
            size="xs"
            aria-label="Previous student (K)"
          >
            Prev
          </Button>
        </Tooltip>
        <Tooltip label="Next student (J)" position="bottom">
          <Button
            rightSection={<Icon name="chevron-right" size={14} />}
            variant="default"
            onClick={onNext}
            disabled={!hasNext}
            size="xs"
            aria-label="Next student (J)"
            data-tour="grader-next"
          >
            Next
          </Button>
        </Tooltip>
      </div>

      <div>
        <label className={styles.fieldLabel}>Points (max {maxPoints})</label>
        <div data-tour="grader-points-input" className={styles.scoreRow}>
          <NumberInput
            ref={scoreInputRef}
            value={score}
            onChange={(v) => onScoreChange(typeof v === "number" ? v : 0)}
            onBlur={onScoreBlur}
            min={0}
            max={maxPoints}
            clampBehavior="strict"
            disabled={isDisabled}
            classNames={{ input: styles.scoreInput }}
          />
        </div>
      </div>

      <div>
        <label className={styles.fieldLabel}>Comment</label>
        <Textarea
          ref={commentRef}
          data-tour="grader-comment-input"
          value={comment}
          onChange={(e) => onCommentChange(e.currentTarget.value)}
          onBlur={onCommentBlur}
          autosize
          minRows={4}
          disabled={isDisabled}
          placeholder={
            isDisabled
              ? "No submissions to comment on yet"
              : "Leave feedback the student will see on their results page"
          }
        />
      </div>
    </div>
  );
});
