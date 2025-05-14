import { FC } from "react";

import { CodeHighlighter } from "../../../shared/CodeHighlighter";

interface SuffixCodeEditorProps {
  suffixCode: string;
  onChange: (code: string) => void;
  language: string;
}

export const SuffixCodeEditor: FC<SuffixCodeEditorProps> = ({ suffixCode, onChange, language }) => {
  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <CodeHighlighter
        code={suffixCode}
        language={language}
        onChange={onChange}
        height="400px"
        placeholder="Enter test code to verify student solutions..."
      />
    </div>
  );
};
