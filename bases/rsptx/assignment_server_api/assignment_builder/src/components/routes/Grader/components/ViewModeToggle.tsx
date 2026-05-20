import { SelectButton } from "primereact/selectbutton";
import React from "react";

import styles from "../Grader.module.css";

export type GraderViewMode = "cards" | "table";

const VIEW_OPTIONS: { label: string; value: GraderViewMode; icon: string }[] = [
  { label: "Cards", value: "cards", icon: "pi pi-th-large" },
  { label: "Table", value: "table", icon: "pi pi-table" }
];

interface ViewModeToggleProps {
  value: GraderViewMode;
  onChange: (mode: GraderViewMode) => void;
  ariaLabel?: string;
  tourId?: string;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  value,
  onChange,
  ariaLabel = "Toggle view",
  tourId
}) => (
  <div
    className={styles.compactToggle}
    style={{
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: "0.4rem"
    }}
    data-tour={tourId}
  >
    <SelectButton
      value={value}
      onChange={(e) => {
        if (e.value) onChange(e.value as GraderViewMode);
      }}
      options={VIEW_OPTIONS}
      optionLabel="label"
      optionValue="value"
      allowEmpty={false}
      itemTemplate={(option: {
        label: string;
        value: GraderViewMode;
        icon: string;
      }) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <i className={option.icon} />
          {option.label}
        </span>
      )}
      aria-label={ariaLabel}
    />
  </div>
);

