import { InputText } from "primereact/inputtext";
import { ProgressBar } from "primereact/progressbar";
import { ToggleButton } from "primereact/togglebutton";
import React, { useMemo, useRef } from "react";

import { GraderStudentAnswer } from "@store/grader/grader.logic.api";

import {
  getQuestionProgress,
  getStudentStatus,
  statusColor,
  statusIcon,
  statusLabel,
  StudentGradingStatus
} from "../state/graderSelectors";
import styles from "./StudentListSidebar.module.css";

interface Props {
  answers: ReadonlyArray<GraderStudentAnswer>;
  question?: { autograde?: string };
  activeSid?: string;
  dirtySids?: ReadonlySet<string>;
  onSelect: (sid: string) => void;
  hideGraded: boolean;
  onToggleHideGraded: (v: boolean) => void;
}

const studentName = (s: GraderStudentAnswer) =>
  `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.sid;

export const StudentListSidebar: React.FC<Props> = ({
  answers,
  question,
  activeSid,
  dirtySids,
  onSelect,
  hideGraded,
  onToggleHideGraded
}) => {
  const [filter, setFilter] = React.useState("");
  const progress = useMemo(
    () => getQuestionProgress(answers, question, { dirtySids }),
    [answers, question, dirtySids]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return answers.filter((a) => {
      const status = getStudentStatus(a, question, { dirtySids });
      if (hideGraded && (status === "graded" || status === "autograded")) return false;
      if (!q) return true;
      return (
        studentName(a).toLowerCase().includes(q) ||
        a.sid.toLowerCase().includes(q)
      );
    });
  }, [answers, filter, hideGraded, question, dirtySids]);

  const listRef = useRef<HTMLUListElement | null>(null);

  return (
    <aside
      className={styles.sidebar}
      data-tour="grader-student-sidebar"
      aria-label="Students"
    >
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <strong>Students</strong>
          <span className={styles.counter}>
            {progress.graded + progress.autograded} / {progress.total}
          </span>
        </div>
        <ProgressBar
          value={progress.donePct}
          showValue={false}
          style={{ height: 6 }}
          color="#6366f1"
          aria-label={`Progress: ${Math.round(progress.donePct)} percent done`}
        />
        <div className={styles.legendRow}>
          <Legend status="graded" count={progress.graded} />
          <Legend status="autograded" count={progress.autograded} />
          <Legend status="pending" count={progress.pending} />
          {progress.noSubmission > 0 && (
            <Legend status="no_submission" count={progress.noSubmission} />
          )}
        </div>
        <div className={styles.controls}>
          <span className="p-input-icon-left" style={{ display: "block", width: "100%" }}>
            <i className="pi pi-search" />
            <InputText
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              style={{ width: "100%", fontSize: 13 }}
            />
          </span>
          <ToggleButton
            checked={hideGraded}
            onChange={(e) => onToggleHideGraded(e.value)}
            onLabel="Hide graded"
            offLabel="All students"
            onIcon="pi pi-filter-fill"
            offIcon="pi pi-filter"
            style={{ fontSize: 12, padding: "0.2rem 0.5rem", width: "100%" }}
            aria-label="Hide already-graded students"
          />
        </div>
      </header>

      <ul ref={listRef} role="listbox" className={styles.list}>
        {filtered.length === 0 && (
          <li className={styles.empty}>No students match the filter.</li>
        )}
        {filtered.map((a) => {
          const status = getStudentStatus(a, question, { dirtySids });
          const active = a.sid === activeSid;
          return (
            <li
              key={a.sid}
              role="option"
              aria-selected={active}
              data-tour={active ? "grader-active-student" : undefined}
              className={`${styles.item} ${active ? styles.active : ""}`}
              onClick={() => onSelect(a.sid)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(a.sid);
                }
              }}
            >
              <StatusDot status={status} />
              <div className={styles.itemBody}>
                <div className={styles.itemName}>{studentName(a)}</div>
                <div className={styles.itemMeta}>
                  <span className={styles.itemSid}>{a.sid}</span>
                  <span>·</span>
                  <span>
                    {a.score != null ? `${a.score}/${a.max_points}` : "—"}
                  </span>
                </div>
              </div>
              {active && (
                <i
                  className="pi pi-angle-right"
                  style={{ color: "#6366f1", fontSize: 12 }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

const StatusDot: React.FC<{ status: StudentGradingStatus }> = ({ status }) => (
  <span
    className={styles.dot}
    style={{ color: statusColor[status] }}
    aria-label={statusLabel[status]}
    title={statusLabel[status]}
  >
    <i className={statusIcon[status]} />
  </span>
);

const Legend: React.FC<{ status: StudentGradingStatus; count: number }> = ({
  status,
  count
}) => {
  if (count === 0) return null;
  return (
    <span className={styles.legend} title={statusLabel[status]}>
      <i className={statusIcon[status]} style={{ color: statusColor[status] }} />
      <span>{count}</span>
    </span>
  );
};
