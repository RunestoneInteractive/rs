import React from "react";

import { QuestionPreviewHeader } from "./RunestonePreview";
import { AnswerRendererProps } from "./types";

export const ParsonsAnswerView: React.FC<AnswerRendererProps> = (props) => {
  const { answer } = props;
  const blocks = (answer || "")
    .split("-")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div>
      <QuestionPreviewHeader {...props} />
      <h4 style={{ margin: "0.75rem 0 0.5rem 0" }}>
        Reconstructed block order ({blocks.length})
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {blocks.length === 0 && (
          <span style={{ color: "#64748b" }}>(no blocks submitted)</span>
        )}
        {blocks.map((b, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(95deg,#eef2ff,#f5f3ff)",
              border: "1px solid #c7d2fe",
              borderRadius: 8,
              padding: "0.45rem 0.6rem",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: 13
            }}
          >
            <span
              style={{
                minWidth: 24,
                height: 24,
                borderRadius: 999,
                background: "#4f46e5",
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700
              }}
            >
              {i + 1}
            </span>
            <code style={{ flex: 1 }}>{b}</code>
          </div>
        ))}
      </div>
    </div>
  );
};

