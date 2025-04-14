import { ExercisePreview } from "@components/routes/AssignmentBuilder/components/exercises/components/ExercisePreview/ExercisePreview";
import { FC, useEffect, useState } from "react";

import { generateDragAndDropPreview } from "@/utils/preview/dndPreview";

import { DragBlock, BlockConnection } from "./types";

interface DragAndDropPreviewProps {
  leftColumnBlocks: DragBlock[];
  rightColumnBlocks: DragBlock[];
  connections: BlockConnection[];
  name: string;
  statement?: string;
}

export const DragAndDropPreview: FC<DragAndDropPreviewProps> = ({
  leftColumnBlocks,
  rightColumnBlocks,
  connections,
  name,
  statement
}) => {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leftColumnBlocks.length === 0 || rightColumnBlocks.length === 0) {
      setError("Please add blocks to both columns to see a preview.");
      setHtml("");
      return;
    }

    try {
      const generatedHtml = generateDragAndDropPreview({
        leftColumnBlocks,
        rightColumnBlocks,
        connections,
        name,
        statement
      });

      setHtml(generatedHtml);
      setError(null);
    } catch (err) {
      setError("An error occurred while generating the preview.");
      setHtml("");
      console.error("Preview generation error:", err);
    }
  }, [leftColumnBlocks, rightColumnBlocks, connections, name, statement]);

  if (error) {
    return (
      <div className="flex justify-center items-center h-52 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-500">
        <p>{error}</p>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex justify-center items-center h-52 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-500">
        <p>Preparing preview...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-content-center w-full">
      <div className="w-full flex justify-content-center">
        <ExercisePreview htmlsrc={html} />
      </div>
    </div>
  );
};
