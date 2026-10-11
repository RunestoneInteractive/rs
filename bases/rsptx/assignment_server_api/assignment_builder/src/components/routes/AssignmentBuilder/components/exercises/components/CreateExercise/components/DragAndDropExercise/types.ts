import { CreateExerciseFormType } from "@/types/exercises";

export interface ItemWithLabel {
  id: string;
  label: string;
  // Shown when this card ends up in the wrong place (PreTeXt cardsort).
  feedback?: string;
}

export interface DragBlock {
  id: string;
  content: string;
}

export interface DragAndDropData extends Partial<CreateExerciseFormType> {
  left: ItemWithLabel[];
  right: ItemWithLabel[];
  correctAnswers: string[][];
  feedback: string;
  statement?: string;
}
