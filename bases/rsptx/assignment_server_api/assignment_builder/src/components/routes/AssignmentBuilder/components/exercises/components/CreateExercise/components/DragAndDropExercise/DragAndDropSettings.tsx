import { FC } from "react";

import { BaseExerciseSettingsContent } from "../../shared/BaseExerciseSettingsContent";

import { DragAndDropData } from "./types";

interface DragAndDropSettingsProps {
  initialData?: Partial<DragAndDropData>;
  onSettingsChange: (settings: Partial<DragAndDropData>) => void;
}

export const DragAndDropSettings: FC<DragAndDropSettingsProps> = ({
  initialData,
  onSettingsChange
}) => {
  return (
    <BaseExerciseSettingsContent initialData={initialData} onSettingsChange={onSettingsChange} />
  );
};
