import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";

import { generateShortAnswerPreview } from "@/utils/preview/shortAnswer";

/* eslint-disable-next-line */
import styles from "../../shared/styles/CreateExercise.module.css";

interface ShortAnswerPreviewProps {
  statement: string;
  attachment: boolean;
  name: string;
}

export const ShortAnswerPreview = ({ statement, attachment, name }: ShortAnswerPreviewProps) => {
  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeader}>
        <h3>Exercise Preview</h3>
        <p className={styles.previewDescription}>
          This is how your short answer exercise will appear to students
          {attachment && " (with file attachment option)"}
        </p>
      </div>
      <div className={styles.previewContent}>
        <ExercisePreview
          htmlsrc={generateShortAnswerPreview(statement || "", attachment, name || "")}
        />
      </div>
    </div>
  );
};
