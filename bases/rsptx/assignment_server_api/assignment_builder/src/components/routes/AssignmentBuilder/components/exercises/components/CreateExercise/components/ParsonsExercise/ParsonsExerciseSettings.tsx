import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";
import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import {
  BaseExerciseSettings,
  BaseExerciseSettingsContent
} from "../../shared/BaseExerciseSettingsContent";

interface ParsonsData extends Partial<CreateExerciseFormType> {
  blocks?: ParsonsBlock[];
  language?: string;
  instructions?: string;
  codeText?: string;
}

interface ParsonsExerciseSettingsProps {
  formData: Partial<ParsonsData>;
  onChange: (settings: Partial<ParsonsData>) => void;
}

export const ParsonsExerciseSettings: FC<ParsonsExerciseSettingsProps> = ({
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
