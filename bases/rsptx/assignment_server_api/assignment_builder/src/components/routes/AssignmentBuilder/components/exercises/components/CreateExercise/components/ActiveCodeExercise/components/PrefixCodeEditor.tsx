import { FC } from "react";

import { CodeHighlighter } from "../../../shared/CodeHighlighter";

interface PrefixCodeEditorProps {
  prefixCode: string;
  onChange: (code: string) => void;
  language: string;
}

export const PrefixCodeEditor: FC<PrefixCodeEditorProps> = ({ prefixCode, onChange, language }) => {
  return (
    <CodeHighlighter
      code={prefixCode}
      language={language}
      onChange={onChange}
      height="400px"
      placeholder="Enter code that will run before the student's code…"
      ariaLabel="Hidden prefix code"
    />
  );
};
