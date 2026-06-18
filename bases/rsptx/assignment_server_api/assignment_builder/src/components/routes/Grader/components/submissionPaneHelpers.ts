import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";

export const formatAnswer = (a: GraderAnswerHistoryItem["answer"] | undefined): string => {
  if (typeof a === "string") return a;
  if (a == null) return "";
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
};

export type CorrectChipKind = "correct" | "partial" | "wrong";

export const correctChipKind = (
  h: Pick<GraderAnswerHistoryItem, "correct" | "percent">
): CorrectChipKind | null => {
  if (h.correct === true) return "correct";
  if (h.correct === false && (h.percent ?? 0) > 0) return "partial";
  if (h.correct === false) return "wrong";
  return null;
};
