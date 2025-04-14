import { FC, useEffect, useState } from "react";

import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { ParsonsMonacoEditor } from "./ParsonsMonacoEditor";
import { ParsonsTipTapEditor } from "./ParsonsTipTapEditor";

interface ParsonsUnifiedEditorProps {
  blocks: ParsonsBlock[];
  onChange: (blocks: ParsonsBlock[]) => void;
  language: string;
}

export const ParsonsUnifiedEditor: FC<ParsonsUnifiedEditorProps> = ({
  blocks,
  onChange,
  language
}) => {
  // State to hold the raw content before converting to blocks
  const [content, setContent] = useState<string>("");

  // Set initial content from blocks if available
  useEffect(() => {
    if (blocks && blocks.length > 0) {
      const initialContent = blocks.map((block) => block.content).join("\n");

      setContent(initialContent);
    }
  }, [blocks]);

  // Handle content changes and update blocks
  const handleContentChange = (newContent: string) => {};

  // Determine which editor to use based on language
  const isTextContent = language === "text";

  return (
    <div>
      {isTextContent ? (
        <ParsonsTipTapEditor content={content} onChange={handleContentChange} />
      ) : (
        <ParsonsMonacoEditor content={content} onChange={handleContentChange} language={language} />
      )}
    </div>
  );
};
