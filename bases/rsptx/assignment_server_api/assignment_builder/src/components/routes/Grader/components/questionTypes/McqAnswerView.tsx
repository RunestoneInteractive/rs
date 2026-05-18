import React from "react";

import { QuestionPreviewHeader } from "./RunestonePreview";
import { AnswerRendererProps } from "./types";

export const McqAnswerView: React.FC<AnswerRendererProps> = (props) => {
  const { answer, correct } = props;
  const selected = (answer || "").split(",").filter(Boolean);

  return (
    <div>
      <QuestionPreviewHeader {...props} />
      <h4 style={{ margin: "0.75rem 0 0.5rem 0" }}>
        Selected option{selected.length > 1 ? "s" : ""}
      </h4>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {selected.length === 0 ? (
          <span style={{ color: "#64748b" }}>(no selection)</span>
        ) : (
          selected.map((s) => (
            <span
              key={s}
              style={{
                padding: "0.3rem 0.7rem",
                borderRadius: 999,
                background: correct ? "#dcfce7" : "#fef3c7",
                color: correct ? "#166534" : "#92400e",
                fontWeight: 600,
                fontSize: 13
              }}
            >
              Option {s}
            </span>
          ))
        )}
      </div>
    </div>
  );
};

