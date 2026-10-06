import React from "react";

import styles from "../AnswerViews.module.css";
import { QuestionPreviewHeader } from "../RunestonePreview";

import { AssociationAnswerViewProps } from "./types";
import { parseAssociationLabels, parseAssociations } from "./utils";

export const AssociationAnswerView: React.FC<AssociationAnswerViewProps> = (props) => {
  const { answer, htmlsrc, kind, showQuestionHeader = true } = props;
  const associations = parseAssociations(kind, answer || "");
  const labels = parseAssociationLabels(htmlsrc);
  const title = kind === "matching" ? "Submitted matches" : "Submitted placements";

  return (
    <div>
      {showQuestionHeader && <QuestionPreviewHeader {...props} />}
      <h4 className={styles.sectionTitle}>{title}</h4>
      <div className={styles.blockList}>
        {associations.length === 0 ? (
          <span className={styles.mutedNote}>
            {answer ? "Stored answer could not be decoded." : "(no placements submitted)"}
          </span>
        ) : (
          associations.map(({ from, to }, index) => (
            <div key={`${from}-${to}-${index}`} className={styles.blockRow}>
              <span className={styles.blockIndex}>{index + 1}</span>
              <code className={styles.blockCode}>
                {labels[from] || from} → {labels[to] || to}
              </code>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
