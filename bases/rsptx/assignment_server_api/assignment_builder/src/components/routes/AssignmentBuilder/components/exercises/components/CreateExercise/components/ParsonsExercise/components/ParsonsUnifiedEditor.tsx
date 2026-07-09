import { FC, useEffect, useState } from "react";

import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { ParsonsMonacoEditor } from "./ParsonsMonacoEditor";
import { ParsonsTipTapEditor } from "./ParsonsTipTapEditor";

interface ParsonsUnifiedEditorProps {
  blocks: ParsonsBlock[];
  onChange: (blocks: ParsonsBlock[]) => void;
  language: string;
}

export const ParsonsUnifiedEditor: FC<ParsonsUnifiedEditorProps> = ({ blocks, language }) => {
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    if (blocks && blocks.length > 0) {
      const initialContent = blocks.map((block) => block.content).join("\n");

      setContent(initialContent);
    }
  }, [blocks]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleContentChange = (newContent: string) => {};

  const isTextEditor = language === "text";

  return (
    <>
      {isTextEditor ? (
        <ParsonsTipTapEditor content={content} onChange={handleContentChange} />
      ) : (
        <ParsonsMonacoEditor content={content} onChange={handleContentChange} language={language} />
      )}
    </>
  );
};
