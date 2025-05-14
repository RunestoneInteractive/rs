import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { FC } from "react";

import styles from "../../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty } from "../../../utils/validation";

interface MultiChoiceQuestionProps {
  content: string;
  onChange: (content: string) => void;
  onFocus?: () => void;
}

export const MultiChoiceQuestion: FC<MultiChoiceQuestionProps> = ({
  content,
  onChange,
  onFocus
}) => {
  const isEmpty = isTipTapContentEmpty(content);

  return (
    <>
      <div className={`${styles.questionEditor} ${isEmpty ? styles.emptyEditor : ""}`}>
        <Editor
          content={content}
          onChange={onChange}
          placeholder="Enter your multiple choice question here..."
          onFocus={onFocus}
        />
      </div>

      <div className={styles.questionTips}>
        <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
        <span>
          Tip: Keep your question concise and specific, making sure it clearly asks what students
          need to answer.
        </span>
      </div>
    </>
  );
};
