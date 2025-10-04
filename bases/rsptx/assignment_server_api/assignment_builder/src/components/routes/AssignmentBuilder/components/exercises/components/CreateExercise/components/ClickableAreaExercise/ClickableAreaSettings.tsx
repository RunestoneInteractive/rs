import { BaseExerciseSettingsContent } from "../../shared/BaseExerciseSettingsContent";
import { ClickableAreaData } from "./types";

interface ClickableAreaSettingsProps {
  initialData: ClickableAreaData;
  onSettingsChange: (settings: Partial<ClickableAreaData>) => void;
}

export const ClickableAreaSettings = ({
  initialData,
  onSettingsChange
}: ClickableAreaSettingsProps) => {
  return (
    <BaseExerciseSettingsContent initialData={initialData} onSettingsChange={onSettingsChange} />
  );
};
