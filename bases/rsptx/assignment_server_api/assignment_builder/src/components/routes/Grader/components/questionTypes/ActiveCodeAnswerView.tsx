import React from "react";

import styles from "./AnswerViews.module.css";
import { QuestionPreviewHeader } from "./RunestonePreview";
import { AnswerRendererProps } from "./types";

export const ActiveCodeAnswerView: React.FC<AnswerRendererProps> = (props) => {
  const { answer } = props;

  return (
    <div>
      <QuestionPreviewHeader {...props} />
      <h4 className={styles.sectionTitle}>Submitted source</h4>
      <pre className={styles.codeBlock}>{answer || "(empty)"}</pre>
    </div>
  );
};
