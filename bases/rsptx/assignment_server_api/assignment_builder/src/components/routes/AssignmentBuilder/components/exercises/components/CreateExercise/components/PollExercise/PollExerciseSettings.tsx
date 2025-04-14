import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import {
  BaseExerciseSettings,
  BaseExerciseSettingsContent
} from "../../shared/BaseExerciseSettingsContent";

export type PollExerciseSettings = BaseExerciseSettings;

interface PollExerciseSettingsProps {
  initialData: Partial<CreateExerciseFormType>;
  onChange: (settings: Partial<CreateExerciseFormType>) => void;
}

export const PollExerciseSettings: FC<PollExerciseSettingsProps> = ({ initialData, onChange }) => {
  return <BaseExerciseSettingsContent initialData={initialData} onSettingsChange={onChange} />;
};
