import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Slider } from "primereact/slider";
import React, { useEffect, useMemo, useState } from "react";

import {
  GraderStudentAnswer,
  useGetGraderHistoryQuery,
  useSaveGradeMutation
} from "@store/grader/grader.logic.api";

import styles from "../Grader.module.css";
import { getDemoHistoryFor } from "../tour/graderDemoData";
import { useGraderTourContext } from "../tour/GraderTourContext";
import { AnswerRenderer } from "./questionTypes/AnswerRenderer";

interface Props {
  visible: boolean;
  onHide: () => void;
  assignmentId: number;
  questionId: number;
  questionName: string;
  questionType: string;
  htmlsrc?: string;
  maxPoints: number;
  student: GraderStudentAnswer | null;
  answers?: GraderStudentAnswer[];
  onSelectStudent?: (student: GraderStudentAnswer) => void;
}

export const AnswerDetailDialog: React.FC<Props> = ({
  visible,
  onHide,
  assignmentId,
  questionId,
  questionName,
  questionType,
  htmlsrc,
  maxPoints,
  student,
  answers,
  onSelectStudent
}) => {
  const skip = !visible || !student;
  const { isDemo } = useGraderTourContext();
  const { data: historyData } = useGetGraderHistoryQuery(
    skip
      ? { assignmentId: 0, questionId: 0, sid: "" }
      : { assignmentId, questionId, sid: student!.sid },
    { skip: skip || isDemo }
  );
  const [saveGrade, { isLoading: saving }] = useSaveGradeMutation();

  const history = isDemo && student ? getDemoHistoryFor(student.sid).history : historyData?.history ?? [];
  const [activeAttempt, setActiveAttempt] = useState<number>(-1);
  const [points, setPoints] = useState<number>(0);
  const [comment, setComment] = useState<string>("");

  const liveStudent = useMemo(() => {
    if (!student) return null;
    return answers?.find((a) => a.sid === student.sid) ?? student;
  }, [answers, student]);

  const currentIndex = useMemo(() => {
    if (!liveStudent || !answers?.length) return -1;
    return answers.findIndex((a) => a.sid === liveStudent.sid);
  }, [answers, liveStudent]);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && !!answers && currentIndex < answers.length - 1;
  const goPrev = () => {
    if (hasPrev && answers && onSelectStudent) onSelectStudent(answers[currentIndex - 1]);
  };
  const goNext = () => {
    if (hasNext && answers && onSelectStudent) onSelectStudent(answers[currentIndex + 1]);
  };

  useEffect(() => {
    if (!student) return;
    setPoints(student.score ?? 0);
    setComment(student.comment ?? "");
    setActiveAttempt(history.length ? history.length - 1 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.sid, history.length]);

  const currentAnswer = useMemo(() => {
    if (activeAttempt >= 0 && history[activeAttempt]) {
      return history[activeAttempt];
    }
    return null;
  }, [activeAttempt, history]);

  const displayedAnswer = (() => {
    const raw = currentAnswer?.answer ?? liveStudent?.answer ?? "";
    if (typeof raw === "string") return raw;
    try {
      return JSON.stringify(raw);
    } catch {
      return String(raw);
    }
  })();

  const handleSave = async () => {
    if (!student) return;
    await saveGrade({
      sid: student.sid,
      div_id: questionName,
      score: points,
      comment,
      questionId,
      assignmentId
    });
  };

  if (!student || !liveStudent) return null;

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={
        <div
          data-tour="grader-dialog-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            minWidth: 0
          }}
        >
          <Button
            icon="pi pi-chevron-left"
            rounded
            outlined
            severity="info"
            aria-label="Previous student"
            tooltip="Previous student"
            tooltipOptions={{ position: "bottom" }}
            onClick={goPrev}
            style={{
              width: "2.25rem",
              height: "2.25rem",
              flex: "0 0 auto",
              visibility: hasPrev ? "visible" : "hidden"
            }}
          />
          <i className="pi pi-user" style={{ color: "#6366f1" }} />
          <span style={{ fontWeight: 700 }}>
            {liveStudent.first_name || liveStudent.sid} {liveStudent.last_name || ""}
          </span>
          <span
            style={{
              fontFamily: "monospace",
              background: "#eef2ff",
              color: "#4338ca",
              padding: "0.1rem 0.45rem",
              borderRadius: 8,
              fontSize: 12
            }}
          >
            {liveStudent.sid}
          </span>
          <span style={{ color: "#64748b", fontSize: 12 }}>
            {liveStudent.attempts} attempt{liveStudent.attempts === 1 ? "" : "s"}
          </span>
          {answers && currentIndex >= 0 && (
            <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 4 }}>
              ({currentIndex + 1} / {answers.length})
            </span>
          )}
          <span style={{ flex: 1 }} />
          <Button
            data-tour="grader-next"
            icon="pi pi-chevron-right"
            rounded
            outlined
            severity="info"
            aria-label="Next student"
            tooltip="Next student"
            tooltipOptions={{ position: "bottom" }}
            onClick={goNext}
            style={{
              width: "2.25rem",
              height: "2.25rem",
              flex: "0 0 auto",
              marginRight: "0.5rem",
              visibility: hasNext ? "visible" : "hidden"
            }}
          />
        </div>
      }
      style={{ width: "min(1080px, 95vw)" }}
      maximizable
      draggable={false}
      modal
    >
      <div className={styles.dialogBody}>
        <div className={styles.previewPane} data-tour="grader-preview-pane">
          <AnswerRenderer
            questionType={questionType}
            htmlsrc={htmlsrc}
            answer={displayedAnswer}
            correct={currentAnswer?.correct ?? liveStudent.correct}
            percent={currentAnswer?.percent ?? liveStudent.percent}
            history={history}
            questionName={questionName}
            questionId={questionId}
            sid={liveStudent.sid}
            activeAttemptIndex={activeAttempt}
          />
        </div>

        <div className={styles.gradePane}>
          <div data-tour="grader-history">
            <h4 style={{ margin: "0 0 0.4rem 0" }}>
              <i className="pi pi-history" /> Attempt history
            </h4>
            {history.length > 1 && (
              <Slider
                value={activeAttempt}
                onChange={(e) => setActiveAttempt(e.value as number)}
                min={0}
                max={history.length - 1}
                step={1}
                style={{ margin: "0.5rem 0 0.75rem" }}
              />
            )}
            <div style={{ maxHeight: 180, overflow: "auto" }}>
              {history.length === 0 && (
                <em style={{ color: "#64748b", fontSize: 12 }}>No prior attempts recorded.</em>
              )}
              {history.map((h, idx) => (
                <div
                  key={h.id}
                  className={`${styles.historyItem} ${idx === activeAttempt ? styles.active : ""}`}
                  onClick={() => setActiveAttempt(idx)}
                  title={h.timestamp || ""}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      fontSize: 11,
                      color: "#475569",
                      marginBottom: 4
                    }}
                  >
                    <strong>#{idx + 1}</strong>
                    {h.timestamp && <span>{new Date(h.timestamp).toLocaleString()}</span>}
                    {h.correct != null && (
                      <span
                        className={`${styles.chip} ${
                          h.correct ? styles.chipCorrect : styles.chipWrong
                        }`}
                      >
                        {h.correct ? "correct" : "wrong"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, maxHeight: 56, overflow: "hidden" }}>
                    {(() => {
                      const a = h.answer;
                      const s =
                        typeof a === "string"
                          ? a
                          : a == null
                          ? ""
                          : (() => {
                              try {
                                return JSON.stringify(a);
                              } catch {
                                return String(a);
                              }
                            })();
                      return s.slice(0, 160) || "(empty)";
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "0.25rem 0" }} />

          <label style={{ fontWeight: 600, fontSize: 13 }}>Points (max {maxPoints})</label>
          <div data-tour="grader-points-input" style={{ display: "flex", gap: 6 }}>
            <InputNumber
              value={points}
              onValueChange={(e) => setPoints(Math.max(0, Math.min(maxPoints, e.value ?? 0)))}
              min={0}
              max={maxPoints}
              showButtons
              buttonLayout="horizontal"
              style={{ flex: 1 }}
              inputStyle={{ width: "100%", textAlign: "center" }}
              decrementButtonClassName="p-button-secondary"
              incrementButtonClassName="p-button-secondary"
              decrementButtonIcon="pi pi-minus"
              incrementButtonIcon="pi pi-plus"
            />
          </div>

          <label style={{ fontWeight: 600, fontSize: 13 }}>Comment</label>
          <InputTextarea
            data-tour="grader-comment-input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            autoResize
            placeholder="Leave feedback the student will see on their results page"
          />

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: "auto",
              justifyContent: "flex-end"
            }}
          >
            <Button
              data-tour="grader-close-btn"
              label="Close"
              icon="pi pi-times"
              severity="secondary"
              outlined
              onClick={onHide}
              disabled={saving}
            />
            <Button
              data-tour="grader-save-btn"
              label={saving ? "Saving…" : "Save grade"}
              icon="pi pi-check"
              onClick={handleSave}
              loading={saving}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};
