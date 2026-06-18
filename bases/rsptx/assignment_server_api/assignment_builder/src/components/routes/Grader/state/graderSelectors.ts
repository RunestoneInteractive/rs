import { GraderQuestionStats, GraderStudentAnswer } from "@store/grader/grader.logic.api";

import type { PrimeIconName } from "@/components/ui/Icon";

export type StudentGradingStatus =
  | "graded"
  | "autograded"
  | "in_progress"
  | "pending"
  | "no_submission";

const isAutogradeManual = (autograde?: string) => !autograde || autograde === "manual";

export const isAutogradeable = (q: { autograde?: string }): boolean =>
  !isAutogradeManual(q.autograde);

export const getStudentStatus = (
  s: GraderStudentAnswer,
  q?: { autograde?: string },
  opts: { dirtySids?: ReadonlySet<string> } = {}
): StudentGradingStatus => {
  if (opts.dirtySids?.has(s.sid)) return "in_progress";

  if (s.attempts === 0 && s.score == null) return "no_submission";

  if (isAutogradeManual(q?.autograde)) {
    if (s.score != null || (s.comment && s.comment.length > 0)) return "graded";
    return "pending";
  }

  if (s.score != null) {
    if (s.comment && s.comment.length > 0) return "graded";
    return "autograded";
  }
  return "pending";
};

export interface QuestionProgress {
  total: number;
  graded: number;
  autograded: number;
  pending: number;
  noSubmission: number;
  inProgress: number;

  donePct: number;
}

export const getQuestionProgress = (
  answers: ReadonlyArray<GraderStudentAnswer>,
  q?: { autograde?: string },
  opts: { dirtySids?: ReadonlySet<string> } = {}
): QuestionProgress => {
  const out: QuestionProgress = {
    total: answers.length,
    graded: 0,
    autograded: 0,
    pending: 0,
    noSubmission: 0,
    inProgress: 0,
    donePct: 0
  };
  for (const a of answers) {
    const st = getStudentStatus(a, q, opts);
    if (st === "graded") out.graded++;
    else if (st === "autograded") out.autograded++;
    else if (st === "pending") out.pending++;
    else if (st === "no_submission") out.noSubmission++;
    else if (st === "in_progress") out.inProgress++;
  }
  const done = out.graded + out.autograded;
  out.donePct = out.total ? (done / out.total) * 100 : 0;
  return out;
};

export const findNextUngradedSid = (
  answers: ReadonlyArray<GraderStudentAnswer>,
  fromIndex: number,
  q?: { autograde?: string },
  opts: { dirtySids?: ReadonlySet<string> } = {}
): string | null => {
  for (let i = fromIndex + 1; i < answers.length; i++) {
    const st = getStudentStatus(answers[i], q, opts);
    if (st === "pending" || st === "in_progress") return answers[i].sid;
  }
  return null;
};

export const findFirstUngradedSid = (
  answers: ReadonlyArray<GraderStudentAnswer>,
  q?: { autograde?: string },
  opts: { dirtySids?: ReadonlySet<string> } = {}
): string | null => findNextUngradedSid(answers, -1, q, opts);

export const statusLabel: Record<StudentGradingStatus, string> = {
  graded: "Graded",
  autograded: "Auto-graded",
  in_progress: "In progress",
  pending: "Pending",
  no_submission: "No submission"
};

export const statusIcon: Record<StudentGradingStatus, PrimeIconName> = {
  graded: "check-circle",
  autograded: "bolt",
  in_progress: "circle-half",
  pending: "circle",
  no_submission: "minus"
};

export const effectiveViewMode = <TMode extends string>(
  isDemo: boolean,
  storedMode: TMode,
  demoMode: TMode
): TMode => (isDemo ? demoMode : storedMode);

export const statusColor: Record<StudentGradingStatus, string> = {
  graded: "var(--rs-status-graded)",
  autograded: "var(--rs-status-autograded)",
  in_progress: "var(--rs-status-in-progress)",
  pending: "var(--rs-status-pending)",
  no_submission: "var(--rs-status-no-submission)"
};

export type { GraderQuestionStats };
