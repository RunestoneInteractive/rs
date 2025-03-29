import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import { BaseExerciseSettings, ExerciseSettings } from "../../shared/ExerciseSettings";

interface ShortAnswerExerciseSettingsProps {
  formData: Partial<CreateExerciseFormType>;
  onChange: (settings: Partial<CreateExerciseFormType>) => void;
  showValidation?: boolean;
}

export const ShortAnswerExerciseSettings: FC<ShortAnswerExerciseSettingsProps> = ({
  formData,
  onChange,
  showValidation = true
}) => {
  return (
    <ExerciseSettings<BaseExerciseSettings>
      initialData={formData}
      onSettingsChange={onChange}
      showValidation={showValidation}
      title="Short Answer Exercise Settings"
      description="Configure the settings for your short answer exercise"
    />
  );
};
