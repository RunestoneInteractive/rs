import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import {
  BaseExerciseSettings,
  BaseExerciseSettingsContent
} from "../../shared/BaseExerciseSettingsContent";

interface SelectQuestionExerciseSettingsProps {
  formData: Partial<CreateExerciseFormType>;
  onChange: (settings: Partial<CreateExerciseFormType>) => void;
}

export const SelectQuestionExerciseSettings: FC<SelectQuestionExerciseSettingsProps> = ({
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
