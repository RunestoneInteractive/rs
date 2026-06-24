import { Checkbox, Paper, Title } from "@mantine/core";
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

      <Paper withBorder p="md" mt="md" bg="var(--rs-surface-sunken)">
        <Title order={4} mb="sm">
          Multiple Choice Display Options
        </Title>

        <Checkbox
          id="forceCheckboxes"
          checked={initialData.forceCheckboxes || false}
          onChange={(e) => handleForceCheckboxChange(e.currentTarget.checked)}
          label="Always show checkboxes (instead of radio buttons for single answer)"
          description="By default, questions with one correct answer show radio buttons and questions with multiple correct answers show checkboxes. Enable this option to always show checkboxes regardless of the number of correct answers."
        />
      </Paper>
    </>
  );
};
