import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import { FC } from "react";

import { generateFillInTheBlankPreview } from "@/utils/preview/fillInTheBlank";

import { BlankWithFeedback } from "./types";

interface FillInTheBlankPreviewProps {
  questionText: string;
  blanks: BlankWithFeedback[];
  name: string;
  questionLabel?: string;
}

export const FillInTheBlankPreview: FC<FillInTheBlankPreviewProps> = ({
  questionText,
  blanks,
  name,
  questionLabel
}) => {
  return (
    <div className="flex items-center justify-content-center w-full">
      <div className="w-full flex justify-content-center">
        <ExercisePreview
          htmlsrc={generateFillInTheBlankPreview({
            questionText,
            blanks,
            name,
            questionLabel
          })}
        />
      </div>
    </div>
  );
};
