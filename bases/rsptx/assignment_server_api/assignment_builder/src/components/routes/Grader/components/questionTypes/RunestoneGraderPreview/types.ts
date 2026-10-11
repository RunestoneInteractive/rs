import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";

export interface RunestoneGraderPreviewProps {
  htmlsrc?: string;
  divId: string;
  questionType: string;
  sid: string;
  attempt?: GraderAnswerHistoryItem | null;
  attemptId?: number | string;
  deadline?: string;
}
