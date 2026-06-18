import { SegmentedControl } from "@mantine/core";
import React from "react";

import { Icon, PrimeIconName } from "@/components/ui/Icon";

import styles from "../Grader.module.css";

export type GraderViewMode = "cards" | "table";

const VIEW_OPTIONS: { label: string; value: GraderViewMode; icon: PrimeIconName }[] = [
  { label: "Cards", value: "cards", icon: "th-large" },
  { label: "Table", value: "table", icon: "table" }
];

interface ViewModeToggleProps {
  value: GraderViewMode;
  onChange: (mode: GraderViewMode) => void;
  ariaLabel?: string;
  tourId?: string;
  disabled?: boolean;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  value,
  onChange,
  ariaLabel = "Toggle view",
  tourId,
  disabled = false
}) => (
  <div className={styles.viewToggle} data-tour={tourId}>
    <SegmentedControl
      value={value}
      onChange={(v) => onChange(v as GraderViewMode)}
      size="xs"
      disabled={disabled}
      aria-label={ariaLabel}
      data={VIEW_OPTIONS.map((option) => ({
        value: option.value,
        label: (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name={option.icon} size={14} />
            {option.label}
          </span>
        )
      }))}
    />
  </div>
);
