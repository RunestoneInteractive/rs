import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { FC } from "react";

import styles from "../../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty } from "../../../utils/validation";
import { useValidation } from "../../../shared/ExerciseLayout";

interface DragAndDropInstructionsProps {
  instructions: string;
  onChange: (instructions: string) => void;
}

export const DragAndDropInstructions: FC<DragAndDropInstructionsProps> = ({
  instructions,
  onChange
}) => {
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
        <span>
          Tip: Clear instructions help students understand how to properly complete the drag and
          drop exercise
        </span>
      </div>
    </>
  );
};
