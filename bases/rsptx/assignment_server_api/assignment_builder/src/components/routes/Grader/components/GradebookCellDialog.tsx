import {
  Alert,
  Anchor,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  Table,
  Text
} from "@mantine/core";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Icon } from "@/components/ui/Icon";
import { notify } from "@/components/ui/notify";
import type {
  GradebookAssignment,
  GradebookStudent,
  RegradeReport,
  StudentAssignmentQuestionScore
} from "@store/grader/grader.logic.api";
import {
  useGetStudentAssignmentScoresQuery,
  useRegradeMutation
} from "@store/grader/grader.logic.api";

import styles from "../Grader.module.css";
import { formatScore, isTotalStale, questionScoreSum } from "../state/gradebookSelectors";

import { ManualTotalForm } from "./ManualTotalForm";

interface GradebookCellDialogProps {
  opened: boolean;
  onClose: () => void;
  assignment: GradebookAssignment | null;
  student: GradebookStudent | null;
  /** The score the gradebook cell shows, used until the breakdown loads. */
  score: number | null;
  manual: boolean;
}

/** The question number is what the student sees in the book; fall back to the
 * div_id for a question that has no number. */
const questionLabel = (q: StudentAssignmentQuestionScore): string =>
  (q.qnumber ?? "").trim() || q.name;

/** Where this question, for this student, is graded. */
const questionGradingPath = (assignmentId: number, questionId: number, sid: string): string =>
  `/grader/${assignmentId}/questions/${questionId}/students/${encodeURIComponent(sid)}`;

const regradeSummary = (report: RegradeReport): string => {
  const parts = [
    `Regraded ${report.total} ${report.total === 1 ? "question" : "questions"}, ${
      report.changed
    } changed.`
  ];

  if (report.skipped_manual) {
    parts.push(`${report.skipped_manual} manually graded and left alone.`);
  }
  if (report.no_submission) {
    parts.push(`${report.no_submission} with no submission.`);
  }
  if (report.errors) {
    parts.push(`${report.errors} could not be regraded.`);
  }
  return parts.join(" ");
};

/**
 * The drill-down behind a gradebook cell: how one student's total on one
 * assignment was earned, question by question, with the tools to fix it (regrade
 * from the saved answers, or override the total by hand).
 */
export const GradebookCellDialog: React.FC<GradebookCellDialogProps> = ({
  opened,
  onClose,
  assignment,
  student,
  score,
  manual
}) => {
  const [regradeReport, setRegradeReport] = useState<RegradeReport | null>(null);
  const [regrade, { isLoading: isRegrading }] = useRegradeMutation();

  const { data, isFetching, isError } = useGetStudentAssignmentScoresQuery(
    { assignmentId: assignment?.id ?? 0, sid: student?.sid ?? "" },
    { skip: !opened || !assignment || !student }
  );

  // A report belongs to the cell it was produced for, not to the dialog.
  useEffect(() => {
    setRegradeReport(null);
  }, [assignment?.id, student?.sid, opened]);

  if (!assignment || !student) return null;

  const questions = data?.questions ?? [];
  // Prefer the freshly fetched total: a regrade may have moved it since the
  // gradebook matrix was cached.
  const totalScore = data ? data.total_score : score;
  const manualTotal = data ? data.manual_total : manual;
  const stale = isTotalStale(questions, totalScore, manualTotal);

  const runRegrade = async () => {
    const questionIds = questions.map((q) => q.id).filter((id) => id != null);

    if (questionIds.length === 0) return;
    try {
      // Manually graded questions are left alone; the total is rolled up by the
      // same call.
      const report = await regrade({
        assignment_id: assignment.id,
        question_ids: questionIds,
        sids: [student.sid],
        overwrite_manual: false,
        enforce_deadline: true,
        recompute_totals: true
      }).unwrap();

      setRegradeReport(report);
    } catch {
      notify.error("Couldn't regrade this student. Try again.");
    }
  };

  const body = () => {
    if (isFetching && !data) {
      return (
        <Center className={styles.loadingWrap}>
          <Loader />
        </Center>
      );
    }

    if (isError) {
      return (
        <Alert color="red" variant="light">
          Could not load the scores for this student.
        </Alert>
      );
    }

    return (
      <>
        <Text size="sm">
          {totalScore == null
            ? "Assignment total: not graded"
            : `Assignment total: ${formatScore(totalScore)}${
                assignment.points ? ` / ${assignment.points}` : ""
              } points`}
        </Text>

        {regradeReport && (
          <Alert color="green" variant="light">
            {regradeSummary(regradeReport)}
          </Alert>
        )}

        {stale && (
          <Alert color="yellow" variant="light" title="The total is out of date">
            <Text size="sm">
              {totalScore == null
                ? `The scores below add up to ${formatScore(
                    questionScoreSum(questions)
                  )}, but no total has been recorded yet.`
                : `The scores below add up to ${formatScore(
                    questionScoreSum(questions)
                  )}, which does not match the recorded total. One of the two is out of date.`}
            </Text>
            <Button
              size="xs"
              mt="xs"
              onClick={runRegrade}
              loading={isRegrading}
              title="Re-score every question in this assignment from this student's saved answers, then recompute the total"
            >
              Regrade this student
            </Button>
          </Alert>
        )}

        {!stale && manualTotal && (
          <Alert color="yellow" variant="light">
            This total was entered by hand, so it may differ from the question scores below.
          </Alert>
        )}

        {questions.length === 0 ? (
          <Text size="sm" c="dimmed">
            This assignment has no questions.
          </Text>
        ) : (
          <Table verticalSpacing="xs" aria-label="Question scores">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Question</Table.Th>
                <Table.Th className={styles.gradebookNumHead}>Score</Table.Th>
                <Table.Th className={styles.gradebookNumHead}>Points</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {questions.map((q) => {
                const label = questionLabel(q);

                return (
                  <Table.Tr key={q.id}>
                    <Table.Td>
                      {/* Grading happens on its own page; open it in a new tab so
                          the gradebook (and this breakdown) stays put. */}
                      <Anchor
                        component={Link}
                        to={questionGradingPath(assignment.id, q.id, student.sid)}
                        target="_blank"
                        rel="noopener"
                        size="sm"
                        title={
                          label === q.name
                            ? "Grade this question in a new tab"
                            : `${q.name} — grade this question in a new tab`
                        }
                      >
                        {label}
                      </Anchor>
                      {/* "autograded" is the placeholder the autograder writes;
                          only a real instructor comment is worth showing. */}
                      {q.comment && q.comment !== "autograded" && (
                        <Text size="xs" fs="italic" c="dimmed">
                          {q.comment}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td className={styles.gradebookNumCell}>
                      {q.score == null ? (
                        <span title="No score recorded">—</span>
                      ) : (
                        formatScore(q.score)
                      )}
                    </Table.Td>
                    <Table.Td className={styles.gradebookNumCell}>{formatScore(q.points)}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}

        <Anchor
          href={`/assignment/student/studentreport?id=${encodeURIComponent(student.sid)}`}
          size="sm"
        >
          <Group gap={4}>
            <Icon name="external-link" size={14} />
            See all work for {student.name}
          </Group>
        </Anchor>

        <Divider label="Override the total" labelPosition="left" />
        <ManualTotalForm
          assignmentId={assignment.id}
          sid={student.sid}
          studentName={student.name}
          score={totalScore}
          manual={manualTotal}
          maxPoints={assignment.points}
        />
      </>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`${student.name} — ${assignment.name}`}
      size="640px"
      centered
    >
      <div className={styles.dialogStack}>{body()}</div>
    </Modal>
  );
};

export default GradebookCellDialog;
