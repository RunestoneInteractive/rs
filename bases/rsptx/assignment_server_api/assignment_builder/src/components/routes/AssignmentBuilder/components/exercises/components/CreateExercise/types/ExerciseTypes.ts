import { CreateExerciseFormType, ExerciseType } from "@/types/exercises";

export interface ExerciseValidation {
  isValid: boolean;
  errors: string[];
}

export interface BaseExerciseProps {
  initialData?: Partial<CreateExerciseFormType>;
  onSave: (exercise: CreateExerciseFormType) => Promise<void>;
  onCancel: () => void;
  resetForm?: boolean;
  onFormReset?: () => void;
  isEdit?: boolean;
}

export interface ExerciseComponentProps extends BaseExerciseProps {
  type: ExerciseType;
}
