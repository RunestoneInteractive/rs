import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputTextarea } from "primereact/inputtextarea";
import React, { forwardRef, useImperativeHandle, useRef } from "react";

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

export const GradePanel = forwardRef<GradePanelHandle, Props>(function GradePanel(
  props,
  ref
) {
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0
        }}
      >
        <i className="pi pi-user" style={{ color: "#6366f1" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {studentName}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {student ? (
              <>
                <span style={{ fontFamily: "ui-monospace, monospace" }}>
                  {student.sid}
                </span>
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
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "#475569",
            cursor: "pointer",
            userSelect: "none"
          }}
          title="When on, jumps to the next ungraded student a moment after saving. You can always undo from the toast."
        >
          <InputSwitch
            checked={!!autoAdvance}
            onChange={(e) => onAutoAdvanceChange(!!e.value)}
          />
          <i className="pi pi-forward" style={{ color: "#6366f1" }} />
          <span>Auto-advance after save</span>
        </label>
      )}

      <div
        style={{
          display: "flex",
          gap: 6,
          paddingTop: 4,
          borderTop: "1px solid #e2e8f0"
        }}
      >
        <Button
          icon="pi pi-chevron-left"
          label="Prev"
          severity="secondary"
          outlined
          onClick={onPrev}
          disabled={!hasPrev}
          size="small"
          style={{ flex: 1 }}
          aria-label="Previous student (K)"
          tooltip="Previous student (K)"
          tooltipOptions={{ position: "bottom" }}
        />
        <Button
          icon="pi pi-chevron-right"
          iconPos="right"
          label="Next"
          severity="secondary"
          outlined
          onClick={onNext}
          disabled={!hasNext}
          size="small"
          style={{ flex: 1 }}
          aria-label="Next student (J)"
          tooltip="Next student (J)"
          tooltipOptions={{ position: "bottom" }}
          data-tour="grader-next"
        />
      </div>

      <div>
        <label style={{ fontWeight: 600, fontSize: 13 }}>
          Points (max {maxPoints})
        </label>
        <div data-tour="grader-points-input" style={{ display: "flex", gap: 6 }}>
          <InputNumber
            inputRef={(el) => {
              scoreInputRef.current = el ?? null;
            }}
            value={score}
            onValueChange={(e) => onScoreChange(e.value ?? 0)}
            onBlur={onScoreBlur}
            min={0}
            max={maxPoints}
            showButtons
            buttonLayout="horizontal"
            disabled={isDisabled}
            style={{ flex: 1 }}
            inputStyle={{ width: "100%", textAlign: "center" }}
            decrementButtonClassName="p-button-secondary"
            incrementButtonClassName="p-button-secondary"
            decrementButtonIcon="pi pi-minus"
            incrementButtonIcon="pi pi-plus"
          />
        </div>
      </div>

      <div>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Comment</label>
        <InputTextarea
          ref={commentRef as any}
          data-tour="grader-comment-input"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          onBlur={onCommentBlur}
          rows={4}
          autoResize
          disabled={isDisabled}
          placeholder={
            isDisabled
              ? "No submissions to comment on yet"
              : "Leave feedback the student will see on their results page"
          }
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
});
