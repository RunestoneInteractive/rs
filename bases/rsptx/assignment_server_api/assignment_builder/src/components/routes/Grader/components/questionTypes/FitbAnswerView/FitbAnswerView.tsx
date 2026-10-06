import React from "react";

import styles from "../AnswerViews.module.css";
import { QuestionPreviewHeader } from "../RunestonePreview";
import { AnswerRendererProps } from "../types";

import { parseBlankValues } from "./utils";

export const FitbAnswerView: React.FC<AnswerRendererProps> = (props) => {
  const { answer } = props;
  const values = parseBlankValues(answer);

  return (
    <div>
      <QuestionPreviewHeader {...props} />
      <h4 className={styles.sectionTitle}>Blanks</h4>
      <ol className={styles.blankList}>
        {values.length === 0 && <li className={styles.mutedNote}>(empty)</li>}
        {values.map((v, i) => (
          <li key={i} className={styles.blankItem}>
            <code className={styles.blankCode}>{v || "(empty)"}</code>
          </li>
        ))}
      </ol>
    </div>
  );
};
