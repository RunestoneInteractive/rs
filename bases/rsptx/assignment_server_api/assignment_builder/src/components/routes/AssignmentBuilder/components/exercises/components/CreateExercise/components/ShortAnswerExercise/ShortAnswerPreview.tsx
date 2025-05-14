import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import { FC } from "react";

import { generateShortAnswerPreview } from "@/utils/preview/shortAnswer";

/* eslint-disable-next-line */
import styles from "../../shared/styles/CreateExercise.module.css";

interface ShortAnswerPreviewProps {
  statement: string;
  attachment: boolean;
  name: string;
}

export const ShortAnswerPreview: FC<ShortAnswerPreviewProps> = ({
  statement,
  attachment,
  name
}) => {
  return (
    <div style={{ display: "flex", alignItems: "start", justifyContent: "center" }}>
      <ExercisePreview
        htmlsrc={generateShortAnswerPreview(statement || "", attachment, name || "")}
      />
    </div>
  );
};
