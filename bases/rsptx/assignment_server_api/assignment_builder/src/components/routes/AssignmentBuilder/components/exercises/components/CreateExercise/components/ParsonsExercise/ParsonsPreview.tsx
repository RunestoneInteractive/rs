import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import { FC } from "react";

import { generateParsonsPreview, ParsonsBlock } from "@/utils/preview/parsonsPreview";

interface ParsonsPreviewProps {
  instructions: string;
  blocks: ParsonsBlock[];
  language: string;
  name: string;
  adaptive?: boolean;
  numbered?: "left" | "right" | "none";
  noindent?: boolean;
  questionLabel?: string;
  grader?: "line" | "dag";
  orderMode?: "random" | "custom";
  customOrder?: number[];
}

export const ParsonsPreview: FC<ParsonsPreviewProps> = ({
  instructions,
  blocks,
  language,
  name,
  adaptive = true,
  numbered = "left",
  noindent = false,
  questionLabel,
  grader = "line",
  orderMode = "random",
  customOrder
}) => {
  return (
    <div style={{ display: "flex", alignItems: "start", justifyContent: "center" }}>
      <ExercisePreview
        htmlsrc={generateParsonsPreview({
          instructions,
          blocks,
          name,
          language,
          adaptive,
          numbered,
          noindent,
          questionLabel: questionLabel || name,
          grader,
          orderMode,
          customOrder
        })}
      />
    </div>
  );
};
