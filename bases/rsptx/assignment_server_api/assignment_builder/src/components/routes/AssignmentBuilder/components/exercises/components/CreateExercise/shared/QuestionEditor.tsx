import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { ReactNode } from "react";

import styles from "./styles/CreateExercise.module.css";

interface QuestionEditorProps {
  title: string;
  helpText: string;
  tipText: string;
  content: string;
  showValidation: boolean;
  isContentEmpty: boolean;
  onChange: (content: string) => void;
  onFocus: () => void;
  extraContent?: ReactNode;
}

export const QuestionEditor = ({
  title,
  helpText,
  tipText,
  content,
  showValidation,
  isContentEmpty,
  onChange,
  onFocus,
  extraContent
}: QuestionEditorProps) => {
  return (
    <div className={styles.questionContainer}>
      <div className={styles.questionHeader}>
        <h3>{title}</h3>
      </div>

      <div className={styles.questionContent}>
        <div className={styles.questionHelp}>
          <i className="pi pi-info-circle"></i>
          <span>{helpText}</span>
        </div>

        <div
          className={`${styles.questionEditor} ${
            showValidation && isContentEmpty ? styles.emptyEditor : ""
          }`}
        >
          <Editor content={content} onChange={onChange} onFocus={onFocus} />
        </div>

        {extraContent && (
          <div className={styles.optionsSection} style={{ marginTop: "20px" }}>
            {extraContent}
          </div>
        )}
      </div>

      <div className={styles.questionFooter}>
        <div className={styles.questionTips}>
          <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
          <span>{tipText}</span>
        </div>

        {showValidation && isContentEmpty && (
          <div className={styles.validationError}>Question is required</div>
        )}
      </div>
    </div>
  );
};
