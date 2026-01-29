import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { SelectButton } from "primereact/selectbutton";
import { FC } from "react";

import styles from "./ParsonsExercise.module.css";

interface ParsonsOptionsProps {
  adaptive: boolean;
  numbered: "left" | "right" | "none";
  noindent: boolean;
  grader: "line" | "dag";
  orderMode: "random" | "custom";
  onAdaptiveChange: (value: boolean) => void;
  onNumberedChange: (value: "left" | "right" | "none") => void;
  onNoindentChange: (value: boolean) => void;
  onGraderChange: (value: "line" | "dag") => void;
  onOrderModeChange: (value: "random" | "custom") => void;
  onAddBlock: () => void;
}

const numberedOptions = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "None", value: "none" }
];

const graderOptions = [
  { label: "Line", value: "line" },
  { label: "DAG", value: "dag" }
];

const orderModeOptions = [
  { label: "Random", value: "random" },
  { label: "Custom", value: "custom" }
];

export const ParsonsOptions: FC<ParsonsOptionsProps> = ({
  adaptive,
  numbered,
  noindent,
  grader,
  orderMode,
  onAdaptiveChange,
  onNumberedChange,
  onNoindentChange,
  onGraderChange,
  onOrderModeChange,
  onAddBlock
}) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <div className={styles.toolbarGroup}>
          <span className={styles.toolbarLabel}>Grader</span>
          <SelectButton
            value={grader}
            options={graderOptions}
            onChange={(e) => {
              if (e.value) {
                onGraderChange(e.value);
                if (e.value === "dag") onAdaptiveChange(false);
              }
            }}
            className={styles.tinySelectButton}
            allowEmpty={false}
          />
        </div>

        <div className={styles.toolbarDivider} />

        <div className={styles.toolbarGroup}>
          <span className={styles.toolbarLabel}>Order</span>
          <SelectButton
            value={orderMode}
            options={orderModeOptions}
            onChange={(e) => {
              if (e.value) onOrderModeChange(e.value);
            }}
            className={styles.tinySelectButton}
            allowEmpty={false}
          />
        </div>

        <div className={styles.toolbarDivider} />

        <div className={styles.toolbarGroup}>
          <span className={styles.toolbarLabel}>Lines</span>
          <Dropdown
            value={numbered}
            options={numberedOptions}
            onChange={(e) => onNumberedChange(e.value)}
            className={styles.tinyDropdown}
          />
        </div>

        <div className={styles.toolbarDivider} />

        <div className={styles.toolbarGroup}>
          <Checkbox
            inputId="adaptive"
            checked={adaptive}
            onChange={(e) => onAdaptiveChange(e.checked ?? false)}
            disabled={grader === "dag"}
            className={styles.tinyCheckbox}
          />
          <label
            htmlFor="adaptive"
            className={`${styles.toolbarCheckLabel} ${grader === "dag" ? styles.disabled : ""}`}
          >
            Adaptive
          </label>
        </div>

        <div className={styles.toolbarGroup}>
          <Checkbox
            inputId="noindent"
            checked={noindent}
            onChange={(e) => onNoindentChange(e.checked ?? false)}
            className={styles.tinyCheckbox}
          />
          <label htmlFor="noindent" className={styles.toolbarCheckLabel}>
            No indent
          </label>
        </div>
      </div>

      <Button
        label="Add Block"
        icon="pi pi-plus"
        className={styles.addBlockBtn}
        onClick={onAddBlock}
        size="small"
      />
    </div>
  );
};
