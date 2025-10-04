import { CreateExerciseFormType } from "@/types/exercises";

export interface ClickableArea {
  id: string;
  text: string;
  isCorrect: boolean;
  startOffset: number;
  endOffset: number;
}

export interface ClickableAreaData extends Partial<CreateExerciseFormType> {
  statement: string;
  questionText: string;
  feedback: string;
  clickableAreas: ClickableArea[];
}
