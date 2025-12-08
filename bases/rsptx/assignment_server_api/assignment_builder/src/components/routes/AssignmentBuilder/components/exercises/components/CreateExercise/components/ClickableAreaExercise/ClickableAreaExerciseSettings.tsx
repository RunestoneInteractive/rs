import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import {
  BaseExerciseSettings,
  BaseExerciseSettingsContent
} from "../../shared/BaseExerciseSettingsContent";

interface ClickableAreaExerciseSettingsProps {
  formData: Partial<CreateExerciseFormType>;
  onChange: (settings: Partial<CreateExerciseFormType>) => void;
}

export const ClickableAreaExerciseSettings: FC<ClickableAreaExerciseSettingsProps> = ({
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
