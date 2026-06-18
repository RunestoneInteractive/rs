import { Loader } from "@mantine/core";
import React from "react";

import { Icon, PrimeIconName } from "@/components/ui/Icon";

import styles from "../Grader.module.css";
import { AutoSaveStatus } from "../hooks/useAutoSaveGrade";

const PILL_CLASS: Record<AutoSaveStatus, string> = {
  idle: "",
  dirty: styles.savePillDirty,
  saving: styles.savePillSaving,
  saved: styles.savePillSaved,
  error: styles.savePillError
};

const ICONS: Record<Exclude<AutoSaveStatus, "idle" | "saving" | "saved">, PrimeIconName> = {
  dirty: "circle",
  error: "exclamation-triangle"
};

const SavedCheckmark: React.FC = () => (
  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" aria-hidden="true">
    <path
      d="M5 12.5l4.5 4.5L19 7"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.savePillCheck}
      data-testid="save-pill-checkmark"
    />
  </svg>
);

const LABELS: Record<AutoSaveStatus, string> = {
  idle: "",
  dirty: "Unsaved",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed"
};

interface Props {
  status: AutoSaveStatus;
  onRetry?: () => void;
  errorMessage?: string;
}

export const SaveStatusPill: React.FC<Props> = ({ status, onRetry, errorMessage }) => {
  if (status === "idle") return null;
  return (
    <span
      className={`${styles.savePill} ${PILL_CLASS[status]}`}
      role="status"
      aria-live="polite"
      title={status === "error" ? errorMessage : undefined}
    >
      {status === "saving" && <Loader size={12} />}
      {status === "saved" && <SavedCheckmark />}
      {(status === "dirty" || status === "error") && <Icon name={ICONS[status]} size={13} />}
      <span>{LABELS[status]}</span>
      {status === "error" && onRetry && (
        <button type="button" onClick={onRetry} className={styles.savePillRetry}>
          Retry
        </button>
      )}
    </span>
  );
};
