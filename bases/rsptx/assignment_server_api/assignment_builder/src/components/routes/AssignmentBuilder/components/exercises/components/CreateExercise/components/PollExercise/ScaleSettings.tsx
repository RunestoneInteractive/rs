import { SCALE_CONFIG } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/constants";
import { InputNumber } from "primereact/inputnumber";
import { classNames } from "primereact/utils";
import { useCallback } from "react";

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
            <InputNumber
              id="scaleValue"
              value={value}
              onValueChange={(e) => onChange(e.value || SCALE_CONFIG.DEFAULT)}
              min={SCALE_CONFIG.MIN}
              max={SCALE_CONFIG.MAX}
              showButtons
              inputClassName="text-center font-semibold"
              size={3}
              useGrouping={false}
              buttonLayout="horizontal"
              decrementButtonClassName="p-button-secondary p-button-text"
              incrementButtonClassName="p-button-secondary p-button-text"
              incrementButtonIcon="pi pi-plus"
              decrementButtonIcon="pi pi-minus"
              step={1}
              aria-label="Maximum scale value"
            />
          </div>
        </div>

        <div className={styles.presets}>
          <p
            className={styles.description}
            style={{ marginBottom: "0.75rem", width: "100%", textAlign: "center" }}
          >
            Quick select:
          </p>
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
        <i className="pi pi-info-circle" style={{ marginRight: "8px" }}></i>
        Students will see options labeled 1 through {value}
      </div>
    </div>
  );
};
