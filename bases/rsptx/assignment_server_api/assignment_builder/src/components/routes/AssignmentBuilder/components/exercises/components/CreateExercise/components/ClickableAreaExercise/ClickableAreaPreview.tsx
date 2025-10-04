import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";

import { generateClickableAreaPreview } from "@/utils/preview/clickableArea";

import { ClickableArea } from "./types";

interface ClickableAreaPreviewProps {
  statement: string;
  questionText: string;
  feedback: string;
  clickableAreas: ClickableArea[];
  name: string;
}

export const ClickableAreaPreview = ({
  statement,
  questionText,
  feedback,
  clickableAreas,
  name
}: ClickableAreaPreviewProps) => {
  return (
    <div style={{ display: "flex", alignItems: "start", justifyContent: "center" }}>
      <ExercisePreview
        htmlsrc={generateClickableAreaPreview({
          statement,
          questionText,
          feedback,
          clickableAreas,
          name
        })}
      />
    </div>
  );
};
