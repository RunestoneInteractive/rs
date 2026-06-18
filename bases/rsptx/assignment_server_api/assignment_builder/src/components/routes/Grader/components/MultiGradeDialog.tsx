import {
  Button,
  Center,
  Loader,
  Modal,
  NumberInput,
  Progress,
  Radio,
  Table,
  Textarea,
  TextInput
} from "@mantine/core";
import React, { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import {
  GraderQuestionStats,
  GraderStudentAnswer,
  useGetCourseRosterQuery,
  useGetGraderAnswersQuery,
  useRecomputeTotalsMutation,
  useSaveGradeMutation
} from "@store/grader/grader.logic.api";

import styles from "../Grader.module.css";

import { StudentMultiSelect } from "./StudentMultiSelect";

interface MultiGradeDialogProps {
  visible: boolean;
  onHide: () => void;
  assignmentId: number;
  questions: GraderQuestionStats[];
}

const PROTECT_COMMENT = "manual";

const studentLabel = (a: GraderStudentAnswer) => {
  const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
  return name ? `${name} (${a.sid})` : a.sid;
};

interface SectionProps {
  assignmentId: number;
  question: GraderQuestionStats;
  allowedSids: Set<string> | null;
  onSaved: (sids: string[]) => void;
}

const QuestionGradeSection: React.FC<SectionProps> = ({
  assignmentId,
  question,
  allowedSids,
  onSaved
}) => {
  const { data, isLoading } = useGetGraderAnswersQuery({
    assignmentId,
    questionId: question.id
  });
  const [save] = useSaveGradeMutation();
  const [edits, setEdits] = useState<Record<string, { score?: number | null; comment?: string }>>(
    {}
  );
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const answers = data?.answers ?? [];
    return allowedSids ? answers.filter((a) => allowedSids.has(a.sid)) : answers;
  }, [data, allowedSids]);

  const maxPoints = data?.question.max_points ?? question.points;

  const editedSids = Object.keys(edits).filter((sid) => {
    const e = edits[sid];
    return e && (e.score !== undefined || (e.comment ?? "") !== "");
  });

  const setScore = (sid: string, score: number | null) =>
    setEdits((p) => ({ ...p, [sid]: { ...p[sid], score } }));
  const setComment = (sid: string, comment: string) =>
    setEdits((p) => ({ ...p, [sid]: { ...p[sid], comment } }));

  const saveSection = async () => {
    if (editedSids.length === 0) return;
    setSaving(true);
    const saved: string[] = [];
    for (const sid of editedSids) {
      const e = edits[sid];
      const row = rows.find((r) => r.sid === sid);
      const score = e.score ?? row?.score ?? 0;
      const comment = (e.comment ?? "").trim() || PROTECT_COMMENT;
      try {
        await save({
          sid,
          div_id: question.name,
          score: Number(score),
          comment,
          questionId: question.id,
          assignmentId
        }).unwrap();
        saved.push(sid);
      } catch {
        // best-effort; skip failed rows
      }
    }
    setEdits({});
    setSaving(false);
    if (saved.length) onSaved(saved);
  };

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionCardHead}>
        <strong title={question.name} className={styles.textStrong}>
          {question.name} <span className={styles.cellSubtle}>/ {maxPoints} pts</span>
        </strong>
        <Button
          leftSection={<Icon name="save" size={14} />}
          size="xs"
          disabled={editedSids.length === 0 || saving}
          loading={saving}
          onClick={saveSection}
        >
          Save {editedSids.length || ""} change{editedSids.length === 1 ? "" : "s"}
        </Button>
      </div>

      {isLoading ? (
        <Center p="md">
          <Loader size="sm" />
        </Center>
      ) : rows.length === 0 ? (
        <p className={`${styles.textSubtle} ${styles.sectionEmpty}`}>No matching submissions.</p>
      ) : (
        <div className={styles.sectionTableScroll}>
          <Table className={styles.multiGradeGrid} verticalSpacing="xs" stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ minWidth: 160 }}>Student</Table.Th>
                <Table.Th style={{ minWidth: 220 }}>Answer</Table.Th>
                <Table.Th style={{ width: 120 }}>Score</Table.Th>
                <Table.Th style={{ minWidth: 180 }}>Comment</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.sid}>
                  <Table.Td>{studentLabel(r)}</Table.Td>
                  <Table.Td>
                    <div className={styles.multiGradeAnswer}>{r.answer || "—"}</div>
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={edits[r.sid]?.score ?? r.score ?? ""}
                      onChange={(v) => setScore(r.sid, typeof v === "number" ? v : null)}
                      min={0}
                      max={maxPoints}
                      w={90}
                      size="xs"
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={edits[r.sid]?.comment ?? r.comment ?? ""}
                      onChange={(e) => setComment(r.sid, e.currentTarget.value)}
                      placeholder={PROTECT_COMMENT}
                      size="xs"
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
    </div>
  );
};

export const MultiGradeDialog: React.FC<MultiGradeDialogProps> = ({
  visible,
  onHide,
  assignmentId,
  questions
}) => {
  const [mode, setMode] = useState<"same" | "grid">("same");
  const [selectedSids, setSelectedSids] = useState<string[]>([]);
  const [sameScore, setSameScore] = useState<number | null>(null);
  const [sameComment, setSameComment] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [affected, setAffected] = useState<Set<string>>(new Set());

  const { data: roster } = useGetCourseRosterQuery();
  const [save] = useSaveGradeMutation();
  const [recompute, { isLoading: recomputing }] = useRecomputeTotalsMutation();

  const allowedSids = selectedSids.length ? new Set(selectedSids) : null;

  const maxOfSelection = useMemo(() => Math.max(0, ...questions.map((q) => q.points)), [questions]);

  const close = () => {
    setProgress(null);
    setAffected(new Set());
    setSameScore(null);
    setSameComment("");
    setSelectedSids([]);
    onHide();
  };

  const addAffected = (sids: string[]) =>
    setAffected((prev) => {
      const next = new Set(prev);
      sids.forEach((s) => next.add(s));
      return next;
    });

  const applySame = async () => {
    if (sameScore == null) return;
    const targetSids =
      selectedSids.length > 0 ? selectedSids : (roster ?? []).map((s) => s.username);
    if (targetSids.length === 0) return;

    const comment = sameComment.trim() || PROTECT_COMMENT;
    const total = targetSids.length * questions.length;
    let done = 0;
    setProgress({ done, total });
    const savedSids: string[] = [];

    for (const sid of targetSids) {
      for (const q of questions) {
        try {
          await save({
            sid,
            div_id: q.name,
            score: Number(sameScore),
            comment,
            questionId: q.id,
            assignmentId
          }).unwrap();
          savedSids.push(sid);
        } catch {
          // best-effort
        }
        done += 1;
        setProgress({ done, total });
      }
    }
    addAffected(savedSids);
    setProgress(null);
  };

  const recomputeNow = async () => {
    await recompute({
      assignment_id: assignmentId,
      sids: Array.from(affected)
    }).unwrap();
    setAffected(new Set());
  };

  return (
    <Modal
      title="Multi-grade selected questions"
      opened={visible}
      onClose={close}
      size="860px"
      centered
    >
      <div className={styles.dialogStack}>
        <p className={styles.dialogIntro}>
          Manually grade {questions.length} selected question
          {questions.length === 1 ? "" : "s"}. Grades are saved per student and protected from later
          auto-grading.
        </p>

        <Radio.Group value={mode} onChange={(v) => setMode(v as "same" | "grid")}>
          <div className={styles.radioRow}>
            <Radio value="same" label="Same grade for all" />
            <Radio value="grid" label="Grade individually (grid)" />
          </div>
        </Radio.Group>

        <StudentMultiSelect
          selected={selectedSids}
          onChange={setSelectedSids}
          label="Students (leave empty to apply to the whole class)"
          height={170}
        />

        {mode === "same" && (
          <div className={styles.fieldStack}>
            <div className={styles.applyRow}>
              <div>
                <label className={styles.fieldHint}>
                  Score (applied to every student × question)
                </label>
                <NumberInput
                  value={sameScore ?? ""}
                  onChange={(v) => setSameScore(typeof v === "number" ? v : null)}
                  min={0}
                  max={maxOfSelection || undefined}
                />
              </div>
              <div className={styles.grow}>
                <label className={styles.fieldHint}>
                  Comment (blank = &quot;{PROTECT_COMMENT}&quot;)
                </label>
                <Textarea
                  value={sameComment}
                  onChange={(e) => setSameComment(e.currentTarget.value)}
                  autosize
                  minRows={1}
                />
              </div>
              <Button
                leftSection={<Icon name="check" size={14} />}
                disabled={sameScore == null || !!progress}
                onClick={applySame}
              >
                Apply
              </Button>
            </div>
            {progress && (
              <div>
                <Progress
                  value={progress.total ? Math.round((progress.done / progress.total) * 100) : 0}
                />
                <small className={styles.textMuted}>
                  Saving {progress.done} / {progress.total}…
                </small>
              </div>
            )}
          </div>
        )}

        {mode === "grid" && (
          <div className={styles.gridScroll}>
            {questions.map((q) => (
              <QuestionGradeSection
                key={q.id}
                assignmentId={assignmentId}
                question={q}
                allowedSids={allowedSids}
                onSaved={addAffected}
              />
            ))}
          </div>
        )}

        <div className={styles.dialogActionsSpread}>
          <Button variant="subtle" onClick={close}>
            Close
          </Button>
          <Button
            leftSection={<Icon name="calculator" size={14} />}
            variant="outline"
            disabled={affected.size === 0 || recomputing}
            loading={recomputing}
            onClick={recomputeNow}
          >
            Recompute totals{affected.size ? ` (${affected.size})` : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default MultiGradeDialog;
