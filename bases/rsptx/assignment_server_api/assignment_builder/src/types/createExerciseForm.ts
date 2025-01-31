import { Control, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";

import { CreateExerciseFormType } from "@/types/exercises";

export interface Choice {
  choice: string;
  feedback: string;
  correct: boolean;
}

export type Chapter = { value: string; label: string };

export type CreateExerciseFormProps = {
  control: Control<CreateExerciseFormType>;
  errors: FieldErrors<CreateExerciseFormType>;
  watch: UseFormWatch<CreateExerciseFormType>;
  setValue: UseFormSetValue<CreateExerciseFormType>;
};
