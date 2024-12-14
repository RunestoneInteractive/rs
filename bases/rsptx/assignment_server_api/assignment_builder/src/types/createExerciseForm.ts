import { Control, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";

export interface Choice {
  text: string;
  feedback: string;
  correct: boolean;
}

export type Chapter = { key: string; label: string };

export type ExerciseDropdownType = Chapter;

export type LanguageDropdownType = Chapter;

export interface FormData {
  exerciseType: ExerciseDropdownType;
  points: number;
  exerciseName: string;
  chapter: Chapter;
  author: string;
  difficulty: number;
  topic: string;
  tags: string[];
  questionPrompt: string;
  allowAttachments: boolean;
  choices: Array<Choice>;
  language: LanguageDropdownType;
  instructions: string;
  hiddenPrefixCode: string;
  starterCode: string;
  hiddenSuffixCode: string;
}

export type CreateExerciseFormProps = {
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
  watch: UseFormWatch<FormData>;
  setValue: UseFormSetValue<FormData>;
};
