import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { FC } from "react";

import { useValidation } from "../../../shared/ExerciseLayout";
import styles from "../../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty } from "../../../utils/validation";

interface ParsonsInstructionsProps {
  instructions: string;
  onChange: (instructions: string) => void;
}

export const ParsonsInstructions: FC<ParsonsInstructionsProps> = ({ instructions, onChange }) => {
  const { shouldShowValidation } = useValidation();
  const isEmpty = isTipTapContentEmpty(instructions);
  const shouldShowError = isEmpty && shouldShowValidation;

  return (
    <>
      <div className={`${styles.questionEditor} ${shouldShowError ? styles.emptyEditor : ""}`}>
        <Editor
          content={instructions}
          onChange={onChange}
          placeholder="Enter instructions here..."
        />
      </div>

      <div className={styles.questionTips}>
        <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
        <span>Tip: Be clear about how the code should be rearranged to solve the problem. Type / in the editor for a menu of options.</span>
      </div>
    </>
  );
};
