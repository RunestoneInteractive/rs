import { Checkbox, SegmentedControl, Select, Tooltip } from "@mantine/core";
import React, { FC } from "react";

import { Icon } from "@/components/ui/Icon";

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
                <span className={styles.optionSectionIcon}>
                  <Icon name="check-circle" size={14} />
                </span>
                <span className={styles.optionSectionTitle}>Grader</span>
              </div>
              <SegmentedControl
                value={grader}
                data={graderOptions}
                onChange={(value) => {
                  onGraderChange(value as "line" | "dag");
                  if (value === "dag") onAdaptiveChange(false);
                }}
                size="xs"
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
                <span className={styles.optionSectionIcon}>
                  <Icon name="sort-alt" size={14} />
                </span>
                <span className={styles.optionSectionTitle}>Order</span>
              </div>
              <SegmentedControl
                value={orderMode}
                data={orderModeOptions}
                onChange={(value) => onOrderModeChange(value as "random" | "custom")}
                size="xs"
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
                <span className={styles.optionSectionIcon}>
                  <Icon name="list" size={14} />
                </span>
                <span className={styles.optionSectionTitle}>Line numbers</span>
              </div>
              <Select
                value={numbered}
                data={numberedOptions}
                onChange={(value) =>
                  onNumberedChange((value as "left" | "right" | "none") ?? "left")
                }
                className={styles.modernDropdown}
                allowDeselect={false}
                comboboxProps={{ withinPortal: false }}
              />
            </div>

            <div className={styles.optionDivider} />
          </>
        )}

        {/* Toggles section */}
        <div className={styles.optionSection} data-tour="toggles-section">
          <div className={styles.optionSectionHeader}>
            <span className={styles.optionSectionIcon}>
              <Icon name="sliders-h" size={14} />
            </span>
            <span className={styles.optionSectionTitle}>Toggles</span>
          </div>
          <div className={styles.togglesGroup}>
            <div
              className={`${styles.toggleItem} ${grader === "dag" ? styles.toggleItemDisabled : ""}`}
            >
              <Tooltip
                label={
                  grader === "dag" ? "Disabled when using DAG grader" : "Enable adaptive feedback"
                }
                position="top"
              >
                <Checkbox
                  id="adaptive-opt"
                  checked={adaptive}
                  onChange={(e) => onAdaptiveChange(e.currentTarget.checked)}
                  disabled={grader === "dag"}
                  label="Adaptive"
                />
              </Tooltip>
            </div>
            {!isSimple && (
              <div className={styles.toggleItem}>
                <Checkbox
                  id="noindent-opt"
                  checked={noindent}
                  onChange={(e) => onNoindentChange(e.currentTarget.checked)}
                  label="No indent"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.optionsActions}>{tourButton}</div>
    </div>
  );
};
