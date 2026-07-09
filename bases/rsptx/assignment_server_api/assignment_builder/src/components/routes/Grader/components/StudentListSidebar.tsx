import { Button, Progress, TextInput } from "@mantine/core";
import React, { useMemo, useRef } from "react";

import { Icon } from "@/components/ui/Icon";
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
      return studentName(a).toLowerCase().includes(q) || a.sid.toLowerCase().includes(q);
    });
  }, [answers, filter, hideGraded, question, dirtySids]);

  const listRef = useRef<HTMLUListElement | null>(null);

  return (
    <aside className={styles.sidebar} data-tour="grader-student-sidebar" aria-label="Students">
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <strong>Students</strong>
          <span className={styles.counter}>
            {progress.graded + progress.autograded} / {progress.total}
          </span>
        </div>
        <Progress
          value={progress.donePct}
          size={4}
          color="brand"
          className={styles.progressTrack}
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
          <TextInput
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            placeholder="Filter…"
            leftSection={<Icon name="search" size={14} />}
            size="xs"
          />
          <Button
            variant={hideGraded ? "filled" : "default"}
            size="xs"
            fullWidth
            leftSection={<Icon name={hideGraded ? "filter-fill" : "filter"} size={13} />}
            onClick={() => onToggleHideGraded(!hideGraded)}
            aria-label="Hide already-graded students"
          >
            {hideGraded ? "Hide graded" : "All students"}
          </Button>
        </div>
      </header>

      <ul ref={listRef} role="listbox" className={styles.list}>
        {filtered.length === 0 && <li className={styles.empty}>No students match the filter.</li>}
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
                  <span>{a.score != null ? `${a.score}/${a.max_points}` : "—"}</span>
                </div>
              </div>
              {active && <Icon name="angle-right" size={12} className={styles.itemChevron} />}
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
    <Icon name={statusIcon[status]} size={14} />
  </span>
);

const Legend: React.FC<{ status: StudentGradingStatus; count: number }> = ({ status, count }) => {
  if (count === 0) return null;
  return (
    <span className={styles.legend} title={statusLabel[status]}>
      <span className={styles.legendIcon} style={{ color: statusColor[status] }}>
        <Icon name={statusIcon[status]} size={13} />
      </span>
      <span className="numeric">{count}</span>
    </span>
  );
};
