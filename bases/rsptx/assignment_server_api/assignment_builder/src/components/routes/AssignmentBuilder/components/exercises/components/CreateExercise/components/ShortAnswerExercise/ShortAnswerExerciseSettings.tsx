import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import {
  BaseExerciseSettings,
  BaseExerciseSettingsContent
} from "../../shared/BaseExerciseSettingsContent";

interface ShortAnswerExerciseSettingsProps {
  formData: Partial<CreateExerciseFormType>;
  onChange: (settings: Partial<CreateExerciseFormType>) => void;
}

export const ShortAnswerExerciseSettings: FC<ShortAnswerExerciseSettingsProps> = ({
  formData,
  onChange
}) => {
  return (
    <BaseExerciseSettingsContent<BaseExerciseSettings>
      initialData={formData}
      onSettingsChange={onChange}
    />
  );
};
