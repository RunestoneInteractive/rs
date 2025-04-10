import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import { BaseExerciseSettings, ExerciseSettings } from "../../shared/ExerciseSettings";

interface MultiChoiceExerciseSettingsProps {
  initialData: Partial<CreateExerciseFormType>;
  onSettingsChange: (settings: Partial<CreateExerciseFormType>) => void;
  showValidation: boolean;
}

export const MultiChoiceExerciseSettings: FC<MultiChoiceExerciseSettingsProps> = ({
  initialData,
  onSettingsChange,
  showValidation
}) => {
  return (
    <ExerciseSettings<BaseExerciseSettings>
      initialData={initialData}
      onSettingsChange={onSettingsChange}
      showValidation={showValidation}
      title="Multiple Choice Exercise Settings"
      description="Configure the settings for your multiple choice exercise"
    />
  );
};
