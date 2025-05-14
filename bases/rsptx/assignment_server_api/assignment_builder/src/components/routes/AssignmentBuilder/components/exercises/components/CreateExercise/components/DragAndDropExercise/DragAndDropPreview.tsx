import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import { FC, useEffect, useState } from "react";

import { generateDragAndDropPreview } from "@/utils/preview/dndPreview";

import { ItemWithLabel } from "./types";

interface DragAndDropPreviewProps {
  left: ItemWithLabel[];
  right: ItemWithLabel[];
  correctAnswers: string[][];
  feedback: string;
  name: string;
  statement?: string;
}

export const DragAndDropPreview: FC<DragAndDropPreviewProps> = ({
  left,
  right,
  correctAnswers,
  feedback,
  name,
  statement
}) => {
  const [generatedHtml, setGeneratedHtml] = useState<string>("");

  useEffect(() => {
    const html = generateDragAndDropPreview({
      left,
      right,
      correctAnswers,
      feedback,
      name,
      statement
    });

    setGeneratedHtml(html);
  }, [left, right, correctAnswers, feedback, name, statement]);

  return (
    <div className="flex items-center justify-content-center w-full">
      <div className="w-full flex justify-content-center">
        <ExercisePreview htmlsrc={generatedHtml} />
      </div>
    </div>
  );
};
