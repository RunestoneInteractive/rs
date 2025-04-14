import { CreateExerciseFormType } from "@/types/exercises";

export interface DragBlock {
  id: string;
  content: string;
}

export interface BlockConnection {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface DragAndDropData extends Partial<CreateExerciseFormType> {
  leftColumnBlocks: DragBlock[];
  rightColumnBlocks: DragBlock[];
  connections: BlockConnection[];
  statement?: string;
}
