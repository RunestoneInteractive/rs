import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import {
  BaseExerciseSettings,
  BaseExerciseSettingsContent
} from "../../shared/BaseExerciseSettingsContent";

interface IframeExerciseSettingsProps {
  formData: Partial<CreateExerciseFormType>;
  onChange: (settings: Partial<CreateExerciseFormType>) => void;
}

export const IframeExerciseSettings: FC<IframeExerciseSettingsProps> = ({ formData, onChange }) => {
  return (
    <BaseExerciseSettingsContent<BaseExerciseSettings>
      initialData={formData}
      onSettingsChange={onChange}
    />
  );
};
