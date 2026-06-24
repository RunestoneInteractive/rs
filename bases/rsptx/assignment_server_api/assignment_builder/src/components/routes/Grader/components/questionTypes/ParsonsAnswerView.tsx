import React from "react";

import styles from "./AnswerViews.module.css";
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
      <h4 className={styles.sectionTitle}>Reconstructed block order ({blocks.length})</h4>
      <div className={styles.blockList}>
        {blocks.length === 0 && <span className={styles.mutedNote}>(no blocks submitted)</span>}
        {blocks.map((b, i) => (
          <div key={i} className={styles.blockRow}>
            <span className={styles.blockIndex}>{i + 1}</span>
            <code className={styles.blockCode}>{b}</code>
          </div>
        ))}
      </div>
    </div>
  );
};
