import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";

export const answerForRestore = (
  questionType: string,
  answer: GraderAnswerHistoryItem["answer"]
): GraderAnswerHistoryItem["answer"] => {
  if (questionType !== "matching" || typeof answer !== "string") return answer;

  try {
    const parsed: unknown = JSON.parse(answer);

    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : answer;
  } catch {
    return answer;
  }
};
