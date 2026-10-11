import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";

import { answerForRestore } from "./answerForRestore";

export const restoreDataForAttempt = (
  questionType: string,
  attempt: GraderAnswerHistoryItem,
  sid: string
): GraderAnswerHistoryItem & { sid: string } => ({
  ...attempt,
  answer: answerForRestore(questionType, attempt.answer ?? ""),
  sid
});
