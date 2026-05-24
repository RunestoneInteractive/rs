import { GraderAnswerHistoryItem } from "@store/grader/grader.logic.api";

export interface AnswerRendererProps {
  htmlsrc?: string;
  answer: string;
  correct?: boolean | null;
  percent?: number | null;
  history: GraderAnswerHistoryItem[];
  questionName: string;
  questionId: number;
  sid: string;

  activeAttemptIndex?: number;
}

