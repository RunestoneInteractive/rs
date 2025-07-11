import { Checkbox } from "primereact/checkbox";
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
  const handleForceCheckboxChange = (checked: boolean) => {
    onSettingsChange({
      ...initialData,
      forceCheckboxes: checked
    });
  };

  return (
    <>
      <BaseExerciseSettingsContent<BaseExerciseSettings>
        initialData={initialData}
        onSettingsChange={onSettingsChange}
      />

      <div className="mt-4 p-3 border-1 border-round surface-50">
        <h4 className="text-lg font-semibold mb-3">Multiple Choice Display Options</h4>

        <div className="flex align-items-center">
          <Checkbox
            inputId="forceCheckboxes"
            checked={initialData.forceCheckboxes || false}
            onChange={(e) => handleForceCheckboxChange(e.checked || false)}
          />
          <label htmlFor="forceCheckboxes" className="ml-2 cursor-pointer">
            Always show checkboxes (instead of radio buttons for single answer)
          </label>
        </div>

        <div className="mt-2 text-sm text-600">
          <p>
            By default, questions with one correct answer show radio buttons and questions with
            multiple correct answers show checkboxes. Enable this option to always show checkboxes
            regardless of the number of correct answers.
          </p>
        </div>
      </div>
    </>
  );
};
