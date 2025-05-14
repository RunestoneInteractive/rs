import { FC } from "react";

import { CodeHighlighter } from "../../../shared/CodeHighlighter";
import styles from "../../../shared/styles/CreateExercise.module.css";

interface ParsonsMonacoEditorProps {
  content: string;
  onChange: (content: string) => void;
  language: string;
}

export const ParsonsMonacoEditor: FC<ParsonsMonacoEditorProps> = ({
  content,
  onChange,
  language
}) => {
  return (
    <div className={`${styles.questionEditor} ${!content ? styles.emptyEditor : ""}`}>
      <CodeHighlighter
        code={content}
        language={language}
        onChange={onChange}
        height="400px"
        placeholder={`Enter ${language} code here...`}
      />
    </div>
  );
};
