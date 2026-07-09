import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { Checkbox, Group } from "@mantine/core";
import { FC } from "react";

import { Icon } from "@/components/ui/Icon";

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
        <Editor content={instructions} onChange={onChange} />
      </div>

      <Checkbox
        id="allowAttachments"
        mt="md"
        checked={attachment}
        onChange={(e) => onAttachmentChange(e.currentTarget.checked)}
        label="Allow file attachments (students can upload files with their answers)"
      />

      <Group className={styles.questionTips} gap={6} align="center" wrap="nowrap" mt="md">
        <Icon name="lightbulb" size={14} color="currentColor" />
        <span>
          Tip: Be concise and specific with your question for better responses. Type / in the editor
          for a menu of options.
        </span>
      </Group>
    </>
  );
};
