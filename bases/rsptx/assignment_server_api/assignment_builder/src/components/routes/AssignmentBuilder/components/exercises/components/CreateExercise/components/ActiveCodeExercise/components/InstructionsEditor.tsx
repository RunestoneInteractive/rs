import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { FC } from "react";

import styles from "../../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty } from "../../../utils/validation";

interface InstructionsEditorProps {
  instructions: string;
  onChange: (instructions: string) => void;
}

export const InstructionsEditor: FC<InstructionsEditorProps> = ({ instructions, onChange }) => {
  return (
    <>
      <div
        className={`${styles.questionEditor} ${
          isTipTapContentEmpty(instructions) ? styles.emptyEditor : ""
        }`}
      >
        <Editor
          content={instructions}
          onChange={onChange}
          placeholder="Enter instructions here..."
        />
      </div>

      <div className={styles.questionTips}>
        <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
        <span>Tip: Be concise and specific with your instructions for better understanding</span>
      </div>
    </>
  );
};
