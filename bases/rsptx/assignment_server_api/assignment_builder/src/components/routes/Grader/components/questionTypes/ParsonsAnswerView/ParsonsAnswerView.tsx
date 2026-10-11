import React from "react";

import styles from "../AnswerViews.module.css";
import { QuestionPreviewHeader } from "../RunestonePreview";
import { AnswerRendererProps } from "../types";

import { reconstructParsonsAnswer } from "./utils";

export const ParsonsAnswerView: React.FC<AnswerRendererProps> = (props) => {
  const { answer, htmlsrc } = props;
  const source = reconstructParsonsAnswer(answer, htmlsrc);
  const displayedSource = source ?? "Stored answer could not be reconstructed.";

  return (
    <div>
      <QuestionPreviewHeader {...props} />
      <h4 className={styles.sectionTitle}>Submitted source</h4>
      <pre className={styles.codeBlock}>{displayedSource || "(empty)"}</pre>
    </div>
  );
};
