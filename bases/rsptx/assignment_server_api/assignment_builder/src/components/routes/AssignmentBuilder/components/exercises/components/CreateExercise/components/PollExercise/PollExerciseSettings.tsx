import { FC } from "react";

import { BaseExerciseSettings, ExerciseSettings } from "../../shared/ExerciseSettings";

export interface PollExerciseSettings extends BaseExerciseSettings {}

interface PollExerciseSettingsProps {
  onSettingsChange: (settings: PollExerciseSettings) => void;
  initialData?: Partial<PollExerciseSettings>;
  showValidation?: boolean;
}

export const PollExerciseSettings: FC<PollExerciseSettingsProps> = ({
  onSettingsChange,
  initialData,
  showValidation = true
}) => {
  return (
    <ExerciseSettings<PollExerciseSettings>
      initialData={initialData}
      onSettingsChange={onSettingsChange}
      showValidation={showValidation}
      title="Poll Exercise Settings"
      description="Configure the settings for your poll exercise"
    />
  );
};
