import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import { BaseExerciseSettings, ExerciseSettings } from "../../shared/ExerciseSettings";

interface ActiveCodeExerciseSettingsProps {
  formData: Partial<CreateExerciseFormType>;
  onChange: (settings: Partial<CreateExerciseFormType>) => void;
  showValidation: boolean;
}

export const ActiveCodeExerciseSettings: FC<ActiveCodeExerciseSettingsProps> = ({
  formData,
  onChange,
  showValidation
}) => {
  return (
    <ExerciseSettings<BaseExerciseSettings>
      initialData={formData}
      onSettingsChange={onChange}
      showValidation={showValidation}
      title="Active Code Exercise Settings"
      description="Configure the settings for your active code exercise"
    />
  );
};
