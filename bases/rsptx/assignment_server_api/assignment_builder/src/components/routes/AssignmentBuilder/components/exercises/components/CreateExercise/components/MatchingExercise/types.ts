import { CreateExerciseFormType } from "@/types/exercises";

export interface ItemWithLabel {
  id: string;
  label: string;
}

export interface DragBlock {
  id: string;
  content: string;
}

export interface MatchingData extends Partial<CreateExerciseFormType> {
  left: ItemWithLabel[];
  right: ItemWithLabel[];
  correctAnswers: string[][];
  feedback: string;
  statement?: string;
}
