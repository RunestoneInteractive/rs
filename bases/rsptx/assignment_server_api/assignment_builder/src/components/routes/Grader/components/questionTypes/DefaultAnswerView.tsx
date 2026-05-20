import React from "react";

import { AnswerRendererProps } from "./types";

export const DefaultAnswerView: React.FC<AnswerRendererProps> = ({ answer }) => {
  return (
    <div>
      <h4 style={{ margin: "0 0 0.5rem 0" }}>Student answer</h4>
      <pre
        style={{
          background: "#0f172a",
          color: "#e2e8f0",
          padding: "0.75rem",
          borderRadius: 8,
          fontSize: 12,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 360,
          overflow: "auto"
        }}
      >
        {answer || "(empty)"}
      </pre>
    </div>
  );
};

