import { Checkbox, Paper, Title } from "@mantine/core";
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
  const handleResultsChange = (checked: boolean) => {
    onChange({
      ...initialData,
      results: checked ? "all" : "instructor"
    });
  };

  return (
    <>
      <BaseExerciseSettingsContent initialData={initialData} onSettingsChange={onChange} />

      <Paper withBorder p="md" mt="md" bg="var(--rs-surface-sunken)">
        <Title order={4} mb="sm">
          Poll Results
        </Title>

        <Checkbox
          id="showResultsToStudents"
          checked={initialData.results === "all"}
          onChange={(e) => handleResultsChange(e.currentTarget.checked)}
          label="Show the results to students"
          description="After voting, students see how the class answered. Instructors always see the results."
        />
      </Paper>
    </>
  );
};
