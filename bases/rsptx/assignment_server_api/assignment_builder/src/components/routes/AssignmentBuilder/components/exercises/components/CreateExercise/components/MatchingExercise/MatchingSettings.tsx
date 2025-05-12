import { FC } from "react";

import { BaseExerciseSettingsContent } from "../../shared/BaseExerciseSettingsContent";

import { MatchingData } from "./types";

interface MatchingSettingsProps {
  initialData?: Partial<MatchingData>;
  onSettingsChange: (settings: Partial<MatchingData>) => void;
}

export const MatchingSettings: FC<MatchingSettingsProps> = ({ initialData, onSettingsChange }) => {
  return (
    <BaseExerciseSettingsContent initialData={initialData} onSettingsChange={onSettingsChange} />
  );
};
