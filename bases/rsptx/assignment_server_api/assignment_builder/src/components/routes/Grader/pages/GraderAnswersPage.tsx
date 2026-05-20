import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { ProgressSpinner } from "primereact/progressspinner";
import React, { useState } from "react";
import { useParams } from "react-router-dom";

import {
  GraderStudentAnswer,
  useGetGraderAnswersQuery,
  useGetGraderQuestionsQuery
} from "@store/grader/grader.logic.api";

import { AnswerDetailDialog } from "../components/AnswerDetailDialog";
import styles from "../Grader.module.css";
import { getDemoAnswersFor, getDemoQuestionsFor } from "../tour/graderDemoData";
import { useGraderTourContext } from "../tour/GraderTourContext";

export const GraderAnswersPage: React.FC = () => {
  const { assignmentId, questionId, sid } = useParams();
  const aid = Number(assignmentId);
  const qid = Number(questionId);

  const { isDemo, demoSelected, setDemoSelected } = useGraderTourContext();

  const { data: qRealData } = useGetGraderQuestionsQuery(aid, {
    skip: !aid || isDemo
  });
  const { data: realData, isLoading } = useGetGraderAnswersQuery(
    { assignmentId: aid, questionId: qid },
    { skip: !aid || !qid || isDemo }
  );

  const data = isDemo ? getDemoAnswersFor(aid, qid) ?? undefined : realData;
  const qData = isDemo ? getDemoQuestionsFor(aid) ?? undefined : qRealData;

  const [selected, setSelected] = useState<GraderStudentAnswer | null>(null);

  const effectiveSelected = isDemo ? demoSelected : selected;

  const questionMeta = qData?.questions.find((q) => q.id === qid);

  const didAutoOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (isDemo) return;
    if (didAutoOpenRef.current) return;
    if (sid && data?.answers.length) {
      const match = data.answers.find((a) => a.sid === sid) || null;
      if (match) {
        setSelected(match);
        didAutoOpenRef.current = true;
      }
    }
  }, [sid, data, isDemo]);

  if (!data && isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
        <ProgressSpinner />
      </div>
    );
  }

  if (!data) {
    return <div className={styles.emptyState}>Could not load student answers.</div>;
  }

  const closeDialog = () => {
    if (isDemo) setDemoSelected(null);
    else setSelected(null);
  };

  return (
    <>
      <div className={styles.tableWrap} data-tour="grader-answers-table">
        <DataTable
          value={data.answers}
          paginator
          rows={25}
          rowsPerPageOptions={[10, 25, 50, 100]}
          selectionMode="single"
          onRowClick={(e) => {
            const row = e.data as GraderStudentAnswer;
            if (isDemo) setDemoSelected(row);
            else setSelected(row);
          }}
          rowHover
          className={styles.row}
          emptyMessage="No student answers yet."
        >
          <Column
            header="Student"
            sortable
            sortField="last_name"
            body={(row: GraderStudentAnswer) => (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <strong>
                  {row.first_name || ""} {row.last_name || ""}
                </strong>
                <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
                  {row.sid}
                </span>
              </div>
            )}
          />
          <Column
            header="Answer"
            body={(row: GraderStudentAnswer) => (
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 12,
                  maxWidth: 360,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "inline-block"
                }}
                title={row.answer || ""}
              >
                {row.answer || <em>(empty)</em>}
              </span>
            )}
          />
          <Column
            header="Attempts"
            field="attempts"
            sortable
            style={{ width: 90 }}
            body={(row: GraderStudentAnswer) => (
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.attempts}</span>
            )}
          />
          <Column
            header="Auto"
            sortable
            sortField="correct"
            style={{ width: 110 }}
            body={(row: GraderStudentAnswer) => {
              if (row.correct == null) {
                return <span className={`${styles.chip} ${styles.chipUnknown}`}>n/a</span>;
              }
              if (row.correct) {
                return <span className={`${styles.chip} ${styles.chipCorrect}`}>correct</span>;
              }
              if ((row.percent ?? 0) > 0) {
                return <span className={`${styles.chip} ${styles.chipPartial}`}>partial</span>;
              }
              return <span className={`${styles.chip} ${styles.chipWrong}`}>wrong</span>;
            }}
          />
          <Column
            header="Score"
            sortable
            sortField="score"
            style={{ width: 110 }}
            body={(row: GraderStudentAnswer) => (
              <strong>
                {row.score != null ? row.score : "—"}
                <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                  {" "}
                  / {row.max_points}
                </span>
              </strong>
            )}
          />
          <Column
            header="Comment"
            body={(row: GraderStudentAnswer) =>
              row.comment ? (
                <span style={{ fontSize: 12 }} title={row.comment}>
                  {row.comment.slice(0, 80)}
                  {row.comment.length > 80 ? "…" : ""}
                </span>
              ) : (
                <span style={{ color: "#cbd5e1" }}>—</span>
              )
            }
          />
          <Column
            header=""
            style={{ width: 60 }}
            body={() => (
              <i className="pi pi-angle-right" style={{ color: "#6366f1" }} />
            )}
          />
        </DataTable>
      </div>

      <AnswerDetailDialog
        visible={!!effectiveSelected}
        onHide={closeDialog}
        assignmentId={aid}
        questionId={qid}
        questionName={data.question.name}
        questionType={data.question.question_type}
        htmlsrc={data.question.htmlsrc || questionMeta?.htmlsrc}
        maxPoints={data.question.max_points}
        student={effectiveSelected}
        answers={data.answers}
        onSelectStudent={(row) => {
          if (isDemo) setDemoSelected(row);
          else setSelected(row);
        }}
      />
    </>
  );
};

export default GraderAnswersPage;

