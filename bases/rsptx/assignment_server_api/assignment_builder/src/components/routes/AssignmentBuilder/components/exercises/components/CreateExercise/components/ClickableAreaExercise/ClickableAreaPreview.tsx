import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import { FC } from "react";

import { generateClickableAreaPreview } from "@/utils/preview/clickableArea";

/* eslint-disable-next-line */
import styles from "../../shared/styles/CreateExercise.module.css";

interface ClickableAreaPreviewProps {
  content: string;
  name: string;
  feedback?: string;
  statement?: string;
}

export const ClickableAreaPreview: FC<ClickableAreaPreviewProps> = ({
  content,
  name,
  feedback,
  statement
}) => {
  return (
    <div style={{ display: "flex", alignItems: "start", justifyContent: "center" }}>
      <ExercisePreview
        htmlsrc={generateClickableAreaPreview(
          content || "",
          name || "",
          feedback || "",
          statement || ""
        )}
      />
    </div>
  );
};
