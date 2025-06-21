import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { FC } from "react";

import { useValidation } from "../../../shared/ExerciseLayout";
import styles from "../../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty } from "../../../utils/validation";

interface ParsonsTipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export const ParsonsTipTapEditor: FC<ParsonsTipTapEditorProps> = ({ content, onChange }) => {
  const { shouldShowValidation } = useValidation();
  const isEmpty = isTipTapContentEmpty(content);
  const shouldShowError = isEmpty && shouldShowValidation;

  return (
    <div className={`${styles.questionEditor} ${shouldShowError ? styles.emptyEditor : ""}`}>
      <Editor content={content} onChange={onChange} placeholder="Enter text content here..." />
    </div>
  );
};
