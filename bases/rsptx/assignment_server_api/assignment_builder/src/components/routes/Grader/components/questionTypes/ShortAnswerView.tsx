import React from "react";

import styles from "./AnswerViews.module.css";
import { QuestionPreviewHeader } from "./RunestonePreview";
import { AnswerRendererProps } from "./types";

export const ShortAnswerView: React.FC<AnswerRendererProps> = (props) => {
  const { answer } = props;

  return (
    <div>
      <QuestionPreviewHeader {...props} />
      <h4 className={styles.sectionTitle}>Student response</h4>
      <div className={styles.responseBox}>
        {answer || <em className={styles.emptyResponse}>(empty response)</em>}
      </div>
    </div>
  );
};
