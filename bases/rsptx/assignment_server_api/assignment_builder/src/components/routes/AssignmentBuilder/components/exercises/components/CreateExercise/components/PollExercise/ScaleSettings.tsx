import { SCALE_CONFIG } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/constants";
import { NumberInput } from "@mantine/core";
import classNames from "classnames";
import { useCallback } from "react";

import { Icon } from "@/components/ui/Icon";

import styles from "./ScaleSettings.module.css";

interface ScaleSettingsProps {
  value: number;
  onChange: (value: number) => void;
}

// Common scale presets
const SCALE_PRESETS = [
  { label: "1-3", value: 3 },
  { label: "1-4", value: 4 },
  { label: "1-5", value: 5 },
  { label: "1-7", value: 7 },
  { label: "1-10", value: 10 },
  { label: "1-20", value: 20 },
  { label: "1-50", value: 50 }
];

export const ScaleSettings = ({ value, onChange }: ScaleSettingsProps) => {
  const handlePresetClick = useCallback(
    (presetValue: number) => {
      onChange(presetValue);
    },
    [onChange]
  );

  return (
    <div className={styles.scaleSettingsContainer}>
      <div className={styles.header}>
        <p className={styles.description}>
          Students will rate from 1 to the maximum value you select
        </p>
      </div>

      <div className={styles.controls}>
        <div className={styles.inputContainer}>
          <label className={styles.label}>Maximum Scale Value:</label>
          <div className={styles.inputWrapper}>
            <NumberInput
              id="scaleValue"
              value={value}
              onChange={(val) => onChange(typeof val === "number" ? val : SCALE_CONFIG.DEFAULT)}
              min={SCALE_CONFIG.MIN}
              max={SCALE_CONFIG.MAX}
              clampBehavior="strict"
              allowNegative={false}
              allowDecimal={false}
              step={1}
              classNames={{ input: styles.scaleInput }}
              aria-label="Maximum scale value"
            />
          </div>
        </div>

        <div className={styles.presets}>
          <p className={classNames(styles.description, styles.quickSelectLabel)}>Quick select:</p>
          {SCALE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={classNames(styles.presetButton, {
                [styles.active]: preset.value === value
              })}
              onClick={() => handlePresetClick(preset.value)}
              type="button"
              aria-pressed={preset.value === value}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.helpText}>
        <Icon name="info-circle" size={14} color="currentColor" />
        Students will see options labeled 1 through {value}
      </div>
    </div>
  );
};
