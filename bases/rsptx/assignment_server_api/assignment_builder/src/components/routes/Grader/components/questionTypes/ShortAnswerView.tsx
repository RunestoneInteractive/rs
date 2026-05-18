import React from "react";

import { QuestionPreviewHeader } from "./RunestonePreview";
import { AnswerRendererProps } from "./types";

export const ShortAnswerView: React.FC<AnswerRendererProps> = (props) => {
  const { answer } = props;

  return (
    <div>
      <QuestionPreviewHeader {...props} />
      <h4 style={{ margin: "0.75rem 0 0.5rem 0" }}>Student response</h4>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "0.75rem",
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
          fontSize: 14,
          color: "#0f172a",
          maxHeight: 340,
          overflow: "auto"
        }}
      >
        {answer || <em style={{ color: "#94a3b8" }}>(empty response)</em>}
      </div>
    </div>
  );
};

