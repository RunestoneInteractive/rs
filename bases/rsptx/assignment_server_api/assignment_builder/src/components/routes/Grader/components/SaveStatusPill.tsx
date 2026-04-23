import React from "react";

import {
  AutoSaveStatus
} from "../hooks/useAutoSaveGrade";

const STYLES: Record<AutoSaveStatus, React.CSSProperties> = {
  idle: { display: "none" },
  dirty: { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" },
  saving: { background: "#eef2ff", color: "#4338ca", borderColor: "#c7d2fe" },
  saved: { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" },
  error: { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }
};

const ICONS: Record<AutoSaveStatus, string> = {
  idle: "",
  dirty: "pi pi-circle",
  saving: "pi pi-spin pi-spinner",
  saved: "pi pi-check",
  error: "pi pi-exclamation-triangle"
};

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
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "0.18rem 0.55rem",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid",
    transition: "background 0.2s, color 0.2s",
    ...STYLES[status]
  };
  return (
    <span
      style={style}
      role="status"
      aria-live="polite"
      title={status === "error" ? errorMessage : undefined}
    >
      <i className={ICONS[status]} />
      <span>{LABELS[status]}</span>
      {status === "error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            border: 0,
            background: "transparent",
            color: "#991b1b",
            textDecoration: "underline",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
            padding: 0
          }}
        >
          Retry
        </button>
      )}
    </span>
  );
};
