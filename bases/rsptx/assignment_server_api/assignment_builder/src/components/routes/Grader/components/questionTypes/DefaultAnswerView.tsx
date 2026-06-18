import React from "react";

import styles from "./AnswerViews.module.css";
import { AnswerRendererProps } from "./types";

export const DefaultAnswerView: React.FC<AnswerRendererProps> = ({ answer }) => {
  return (
    <div>
      <h4 className={styles.rendererTitle}>Student answer</h4>
      <pre className={styles.codeBlock}>{answer || "(empty)"}</pre>
    </div>
  );
};
