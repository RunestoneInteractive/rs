import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { SelectButton } from "primereact/selectbutton";
import { Tooltip } from "primereact/tooltip";
import React, { FC } from "react";

import styles from "./ParsonsExercise.module.css";

interface ParsonsOptionsProps {
  adaptive: boolean;
  numbered: "left" | "right" | "none";
  noindent: boolean;
  grader: "line" | "dag";
  orderMode: "random" | "custom";
  mode: "simple" | "enhanced";
  onAdaptiveChange: (value: boolean) => void;
  onNumberedChange: (value: "left" | "right" | "none") => void;
  onNoindentChange: (value: boolean) => void;
  onGraderChange: (value: "line" | "dag") => void;
  onOrderModeChange: (value: "random" | "custom") => void;
  onAddBlock: () => void;
  tourButton?: React.ReactNode;
}

const numberedOptions = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "None", value: "none" }
];

const graderOptions = [
  { label: "Line-based", value: "line" },
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
  mode,
  onAdaptiveChange,
  onNumberedChange,
  onNoindentChange,
  onGraderChange,
  onOrderModeChange,
  onAddBlock,
  tourButton
}) => {
  const isSimple = mode === "simple";

  return (
    <div className={styles.optionsBar} data-tour="options-bar">
      {/* Left section — configuration controls */}
      <div className={styles.optionsRow}>
        {/* Grader section — Enhanced mode only */}
        {!isSimple && (
          <>
            <div className={styles.optionSection} data-tour="grader-section">
              <div className={styles.optionSectionHeader}>
                <i className={`pi pi-check-circle ${styles.optionSectionIcon}`} />
                <span className={styles.optionSectionTitle}>Grader</span>
              </div>
              <SelectButton
                value={grader}
                options={graderOptions}
                onChange={(e) => {
                  if (e.value) {
                    onGraderChange(e.value);
                    if (e.value === "dag") onAdaptiveChange(false);
                  }
                }}
                className={styles.modernSelectButton}
                allowEmpty={false}
              />
            </div>

            <div className={styles.optionDivider} />
          </>
        )}

        {/* Block order section — Enhanced mode only */}
        {!isSimple && (
          <>
            <div className={styles.optionSection} data-tour="order-section">
              <div className={styles.optionSectionHeader}>
                <i className={`pi pi-sort-alt ${styles.optionSectionIcon}`} />
                <span className={styles.optionSectionTitle}>Order</span>
              </div>
              <SelectButton
                value={orderMode}
                options={orderModeOptions}
                onChange={(e) => {
                  if (e.value) onOrderModeChange(e.value);
                }}
                className={styles.modernSelectButton}
                allowEmpty={false}
              />
            </div>

            <div className={styles.optionDivider} />
          </>
        )}

        {/* Line Numbers — Enhanced mode only */}
        {!isSimple && (
          <>
            <div className={styles.optionSection} data-tour="line-numbers-section">
              <div className={styles.optionSectionHeader}>
                <i className={`pi pi-list ${styles.optionSectionIcon}`} />
                <span className={styles.optionSectionTitle}>Line Numbers</span>
              </div>
              <Dropdown
                value={numbered}
                options={numberedOptions}
                onChange={(e) => onNumberedChange(e.value)}
                className={styles.modernDropdown}
                appendTo="self"
              />
            </div>

            <div className={styles.optionDivider} />
          </>
        )}

        {/* Toggles section */}
        <div className={styles.optionSection} data-tour="toggles-section">
          <div className={styles.optionSectionHeader}>
            <i className={`pi pi-sliders-h ${styles.optionSectionIcon}`} />
            <span className={styles.optionSectionTitle}>Toggles</span>
          </div>
          <div className={styles.togglesGroup}>
            <Tooltip target=".adaptive-toggle-label" position="top" />
            <div
              className={`${styles.toggleItem} ${grader === "dag" ? styles.toggleItemDisabled : ""}`}
            >
              <Checkbox
                inputId="adaptive-opt"
                checked={adaptive}
                onChange={(e) => onAdaptiveChange(e.checked ?? false)}
                disabled={grader === "dag"}
                className={styles.modernCheckbox}
              />
              <label
                htmlFor="adaptive-opt"
                className={`${styles.toggleLabel} adaptive-toggle-label ${grader === "dag" ? styles.toggleLabelDisabled : ""}`}
                data-pr-tooltip={
                  grader === "dag" ? "Disabled when using DAG grader" : "Enable adaptive feedback"
                }
              >
                Adaptive
              </label>
            </div>
            {/* No indent — Enhanced mode only */}
            {!isSimple && (
              <div className={styles.toggleItem}>
                <Checkbox
                  inputId="noindent-opt"
                  checked={noindent}
                  onChange={(e) => onNoindentChange(e.checked ?? false)}
                  className={styles.modernCheckbox}
                />
                <label htmlFor="noindent-opt" className={styles.toggleLabel}>
                  No indent
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right section — Add block + Tour */}
      <div className={styles.optionsActions} data-tour="add-block-area">
        <Button
          label="Add Block"
          icon="pi pi-plus"
          className={styles.addBlockButton}
          onClick={onAddBlock}
          size="small"
          severity="info"
          outlined
          data-tour="add-block-btn"
        />
        {tourButton}
      </div>
    </div>
  );
};
