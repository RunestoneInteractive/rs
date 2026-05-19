import React from "react";

import { QuestionPreviewHeader } from "./RunestonePreview";
import { AnswerRendererProps } from "./types";

export const ActiveCodeAnswerView: React.FC<AnswerRendererProps> = (props) => {
  const { answer } = props;

  return (
    <div>
      <QuestionPreviewHeader {...props} />
      <h4 style={{ margin: "0.75rem 0 0.5rem 0" }}>Submitted source</h4>
      <pre
        style={{
          background: "#0f172a",
          color: "#e2e8f0",
          padding: "0.85rem 1rem",
          borderRadius: 10,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: 12.5,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 380,
          overflow: "auto"
        }}
      >
        {answer || "(empty)"}
      </pre>
    </div>
  );
};

