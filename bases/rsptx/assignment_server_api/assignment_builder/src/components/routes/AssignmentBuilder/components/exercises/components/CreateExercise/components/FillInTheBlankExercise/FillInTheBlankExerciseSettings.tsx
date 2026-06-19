import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import { BaseExerciseSettingsContent } from "../../shared/BaseExerciseSettingsContent";

import { FillInTheBlankSettings } from "./types";

interface FillInTheBlankExerciseSettingsProps {
  initialData: Partial<CreateExerciseFormType>;
  onSettingsChange: (settings: Partial<CreateExerciseFormType>) => void;
}

export const FillInTheBlankExerciseSettings: FC<FillInTheBlankExerciseSettingsProps> = ({
  initialData,
  onSettingsChange
}) => {
  return (
    <BaseExerciseSettingsContent<FillInTheBlankSettings>
      initialData={initialData}
      onSettingsChange={onSettingsChange}
    />
  );
};
