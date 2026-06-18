import React from "react";

import styles from "./AnswerViews.module.css";
import { QuestionPreviewHeader } from "./RunestonePreview";
import { AnswerRendererProps } from "./types";

export const McqAnswerView: React.FC<AnswerRendererProps> = (props) => {
  const { answer, correct } = props;
  const selected = (answer || "").split(",").filter(Boolean);

  return (
    <div>
      <QuestionPreviewHeader {...props} />
      <h4 className={styles.sectionTitle}>Selected option{selected.length > 1 ? "s" : ""}</h4>
      <div className={styles.optionChips}>
        {selected.length === 0 ? (
          <span className={styles.mutedNote}>(no selection)</span>
        ) : (
          selected.map((s) => (
            <span
              key={s}
              className={`${styles.optionChip} ${
                correct ? styles.optionChipCorrect : styles.optionChipWrong
              }`}
            >
              Option {s}
            </span>
          ))
        )}
      </div>
    </div>
  );
};
