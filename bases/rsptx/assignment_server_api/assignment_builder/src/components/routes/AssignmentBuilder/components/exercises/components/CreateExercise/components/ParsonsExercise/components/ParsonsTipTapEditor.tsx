import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { FC } from "react";

import styles from "../../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty } from "../../../utils/validation";

interface ParsonsTipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export const ParsonsTipTapEditor: FC<ParsonsTipTapEditorProps> = ({ content, onChange }) => {
  const isEmpty = isTipTapContentEmpty(content);

  return (
    <div className={`${styles.questionEditor} ${isEmpty ? styles.emptyEditor : ""}`}>
      <Editor content={content} onChange={onChange} placeholder="Enter text content here..." />
    </div>
  );
};
