import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { FC } from "react";

import styles from "../../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty } from "../../../utils/validation";

interface PollQuestionEditorProps {
  question: string;
  onChange: (question: string) => void;
}

export const PollQuestionEditor: FC<PollQuestionEditorProps> = ({ question, onChange }) => {
  const isEmpty = isTipTapContentEmpty(question);

  return (
    <>
      <div className={`${styles.questionEditor} ${isEmpty ? styles.emptyEditor : ""}`}>
        <Editor content={question} onChange={onChange} placeholder="Enter poll question here..." />
      </div>

      <div className={styles.questionTips}>
        <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
        <span>
          Tip: Create a clear question that students will respond to with the poll options
        </span>
      </div>
    </>
  );
};
