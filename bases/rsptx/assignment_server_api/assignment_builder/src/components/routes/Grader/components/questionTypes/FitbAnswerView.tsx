import React from "react";

import { QuestionPreviewHeader } from "./RunestonePreview";
import { AnswerRendererProps } from "./types";

export const FitbAnswerView: React.FC<AnswerRendererProps> = (props) => {
  const { answer } = props;
  let values: string[] = [];
  try {
    const parsed = JSON.parse(answer);
    values = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    values = answer ? answer.split(",") : [];
  }

  return (
    <div>
      <QuestionPreviewHeader {...props} />
      <h4 style={{ margin: "0.75rem 0 0.5rem 0" }}>Blanks</h4>
      <ol style={{ paddingLeft: "1.25rem", margin: 0 }}>
        {values.length === 0 && <li style={{ color: "#64748b" }}>(empty)</li>}
        {values.map((v, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <code
              style={{
                background: "#eef2ff",
                padding: "0.15rem 0.45rem",
                borderRadius: 6,
                color: "#3730a3"
              }}
            >
              {v || "(empty)"}
            </code>
          </li>
        ))}
      </ol>
    </div>
  );
};

