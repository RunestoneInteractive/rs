import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { FC } from "react";

import { useValidation } from "../../../shared/ExerciseLayout";
import styles from "../../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty } from "../../../utils/validation";

interface PollQuestionEditorProps {
  question: string;
  onChange: (question: string) => void;
}

export const PollQuestionEditor: FC<PollQuestionEditorProps> = ({ question, onChange }) => {
  const { shouldShowValidation } = useValidation();
  const isEmpty = isTipTapContentEmpty(question);
  const shouldShowError = isEmpty && shouldShowValidation;

  return (
    <>
      <div className={`${styles.questionEditor} ${shouldShowError ? styles.emptyEditor : ""}`}>
        <Editor content={question} onChange={onChange} />
      </div>

      <div className={styles.questionTips}>
        <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
        <span>
          Tip: Create a clear question that students will respond to with the poll options. Type /
          in the editor for a menu of options.
        </span>
      </div>
    </>
  );
};
