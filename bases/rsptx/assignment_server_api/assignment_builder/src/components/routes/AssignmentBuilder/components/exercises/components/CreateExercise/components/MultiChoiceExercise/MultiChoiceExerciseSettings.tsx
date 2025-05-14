import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import {
  BaseExerciseSettings,
  BaseExerciseSettingsContent
} from "../../shared/BaseExerciseSettingsContent";

interface MultiChoiceExerciseSettingsProps {
  initialData: Partial<CreateExerciseFormType>;
  onSettingsChange: (settings: Partial<CreateExerciseFormType>) => void;
}

export const MultiChoiceExerciseSettings: FC<MultiChoiceExerciseSettingsProps> = ({
  initialData,
  onSettingsChange
}) => {
  return (
    <BaseExerciseSettingsContent<BaseExerciseSettings>
      initialData={initialData}
      onSettingsChange={onSettingsChange}
    />
  );
};
