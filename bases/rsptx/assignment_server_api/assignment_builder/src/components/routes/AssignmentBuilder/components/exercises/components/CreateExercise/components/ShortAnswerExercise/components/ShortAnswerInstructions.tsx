import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { Checkbox } from "primereact/checkbox";
import { FC } from "react";

import { useValidation } from "../../../shared/ExerciseLayout";
import styles from "../../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty } from "../../../utils/validation";

interface ShortAnswerInstructionsProps {
  instructions: string;
  onChange: (instructions: string) => void;
  attachment: boolean;
  onAttachmentChange: (checked: boolean) => void;
}

export const ShortAnswerInstructions: FC<ShortAnswerInstructionsProps> = ({
  instructions,
  onChange,
  attachment,
  onAttachmentChange
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

      <div className="flex align-items-center mt-4">
        <Checkbox
          inputId="allowAttachments"
          checked={attachment}
          onChange={(e) => onAttachmentChange(Boolean(e.checked))}
        />
        <label htmlFor="allowAttachments" className="ml-2 cursor-pointer">
          Allow file attachments (students can upload files with their answers)
        </label>
      </div>

      <div className={styles.questionTips}>
        <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
        <span>Tip: Be concise and specific with your question for better responses. Type / in the editor for a menu of options.</span>
      </div>
    </>
  );
};
