import { CreateExerciseFormType } from "@/types/exercises";

import { BaseExerciseSettings } from "../../shared/BaseExerciseSettingsContent";

export enum GraderType {
  STRING = "string",
  REGEX = "regex",
  NUMBER = "number"
}

export interface BlankWithFeedback {
  id: string;
  graderType: GraderType;
  exactMatch?: string;
  regexPattern?: string;
  regexFlags?: string;
  numberMin?: string;
  numberMax?: string;
  correctFeedback?: string;
  incorrectFeedback?: string;
}

export interface FillInTheBlankData extends Partial<CreateExerciseFormType> {
  questionText?: string;
  blanks?: BlankWithFeedback[];
}

export type FillInTheBlankSettings = BaseExerciseSettings;

export interface FillInTheBlankPreviewProps {
  questionText: string;
  blanks: BlankWithFeedback[];
  name: string;
  questionLabel?: string;
}
