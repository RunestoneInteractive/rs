import { isTipTapContentEmpty } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/utils/validation";
import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import parse from "html-react-parser";
import React, { FC, useState } from "react";

import { useValidation } from "../../../shared/ExerciseLayout";
import styles from "../../../shared/styles/CreateExercise.module.css";

interface QuestionEditorProps {
  questionText: string;
  onChange: (value: string) => void;
}

export const QuestionEditor: FC<QuestionEditorProps> = ({ questionText, onChange }) => {
  const [text, setText] = useState(questionText);
  const { shouldShowValidation } = useValidation();

  const handleChange = (value: string) => {
    setText(value);
    onChange(value);
  };

  const isEmpty = isTipTapContentEmpty(text);
  const shouldShowError = isEmpty && shouldShowValidation;

  const renderPreviewContent = () => {
    if (!text) return null;

    const processedHtml = text.replace(
      /{blank}/g,
      '<span class="bg-primary-100 text-primary border-round px-2 py-1">_______</span>'
    );

    return parse(processedHtml);
  };

  return (
    <>
      <div className={`${styles.questionEditor} ${shouldShowError ? styles.emptyEditor : ""}`}>
        <Editor
          content={text}
          onChange={handleChange}
          placeholder="Enter your question text with {blank} placeholders..."
          enableBlankOption
        />
      </div>

      <div className={styles.questionTips}>
        <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
        <span>
          Use {"{blank}"} in your text to indicate where blanks should appear. Each blank will be
          replaced with an input field.
        </span>
      </div>

      {text && (
        <div className="mt-4 p-3 border-1 border-round surface-100">
          <h4 className="text-lg font-medium mb-2">Preview</h4>
          <div>{renderPreviewContent()}</div>
        </div>
      )}
    </>
  );
};
