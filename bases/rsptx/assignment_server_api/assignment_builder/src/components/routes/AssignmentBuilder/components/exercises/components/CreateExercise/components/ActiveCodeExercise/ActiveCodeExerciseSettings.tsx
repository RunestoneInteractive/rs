import { Group, Select, Switch, TextInput, Tooltip } from "@mantine/core";
import { FC } from "react";

import { Icon } from "@/components/ui/Icon";
import { CreateExerciseFormType } from "@/types/exercises";

import {
  BaseExerciseSettings,
  BaseExerciseSettingsContent
} from "../../shared/BaseExerciseSettingsContent";
import styles from "../../shared/styles/CreateExerciseSettings.module.css";

interface ActiveCodeExerciseSettingsProps {
  formData: Partial<CreateExerciseFormType>;
  onChange: (settings: Partial<CreateExerciseFormType>) => void;
}

const PERSONALIZATION_LEVELS = [
  { label: "Arrange all blocks", value: "movable" },
  { label: "Correct blocks locked; arrange incorrect blocks", value: "partial" }
];

const InfoTooltip: FC<{ label: string }> = ({ label }) => (
  <Tooltip label={label} position="right" multiline w={260}>
    <span className={styles.infoIcon}>
      <Icon name="info-circle" />
    </span>
  </Tooltip>
);

export const ActiveCodeExerciseSettings: FC<ActiveCodeExerciseSettingsProps> = ({
  formData,
  onChange
}) => {
  const handleCodeTailorToggle = (enabled: boolean) => {
    onChange({
      enableCodeTailor: enabled,
      parsonspersonalize: enabled ? "movable" : "",
      parsonsexample: enabled ? formData.parsonsexample : "",
      parsonsPersonalized: enabled ? (formData.parsonsPersonalized ?? true) : true
    });
  };

  const handlePersonalizationChange = (value: "movable" | "partial") => {
    onChange({ parsonspersonalize: value });
  };

  const handleParsonsExampleChange = (value: string) => {
    onChange({ parsonsexample: value });
  };

  const codeTailorFields = (
    <div className={styles.codeTailorSection}>
      <div className={styles.formField}>
        <Group align="center" gap="xl">
          <Group align="center" gap="xs">
            <Switch
              id="enableCodeTailor"
              label="Personalized Parsons support (CodeTailor)"
              checked={formData.enableCodeTailor ?? false}
              onChange={(e) => handleCodeTailorToggle(e.currentTarget.checked)}
            />
            <InfoTooltip label="CodeTailor provides personalized Parsons puzzles as adaptive support for students struggling with coding exercises." />
          </Group>

          <Group align="center" gap="xs">
            <Switch
              id="enableCodelens"
              label="Show CodeLens button"
              checked={formData.enableCodelens ?? true}
              onChange={(e) => onChange({ enableCodelens: e.currentTarget.checked })}
            />
            <InfoTooltip label="CodeLens button provides step-by-step visualization of code execution." />
          </Group>
        </Group>
      </div>

      {formData.enableCodeTailor && (
        <div className={styles.codeTailorOptions}>
          <div className={styles.formField}>
            <Select
              id="parsonspersonalize"
              label="Personalized blocks to arrange"
              value={formData.parsonspersonalize || "movable"}
              data={PERSONALIZATION_LEVELS}
              allowDeselect={false}
              onChange={(value) =>
                handlePersonalizationChange((value as "movable" | "partial") || "movable")
              }
            />
          </div>

          <div className={styles.formField}>
            <TextInput
              id="parsonsexample"
              label="Backup example solution"
              value={formData.parsonsexample || ""}
              onChange={(e) => handleParsonsExampleChange(e.target.value)}
              placeholder="Parsons problem ID (optional)"
            />
          </div>

          <div className={styles.formField}>
            <Group align="center" gap="xs">
              <Switch
                id="parsonsPersonalized"
                label="Personalize to student's code (CodeTailor)"
                checked={formData.parsonsPersonalized ?? true}
                onChange={(e) => onChange({ parsonsPersonalized: e.currentTarget.checked })}
              />
              <InfoTooltip label="When off, 'Get Help' shows the example Parsons puzzle without adapting to the student's code." />
            </Group>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <BaseExerciseSettingsContent<BaseExerciseSettings>
      initialData={formData}
      onSettingsChange={onChange}
      additionalFields={codeTailorFields}
    />
  );
};
