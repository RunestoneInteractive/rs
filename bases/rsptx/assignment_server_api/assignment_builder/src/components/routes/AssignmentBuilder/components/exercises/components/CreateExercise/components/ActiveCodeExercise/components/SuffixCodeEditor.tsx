import { FC } from "react";

import { CodeHighlighter } from "../../../shared/CodeHighlighter";

interface SuffixCodeEditorProps {
  suffixCode: string;
  onChange: (code: string) => void;
  language: string;
}

export const SuffixCodeEditor: FC<SuffixCodeEditorProps> = ({ suffixCode, onChange, language }) => {
  return (
    <CodeHighlighter
      code={suffixCode}
      language={language}
      onChange={onChange}
      height="400px"
      placeholder="Enter test code to verify student solutions…"
      ariaLabel="Hidden suffix code"
    />
  );
};
