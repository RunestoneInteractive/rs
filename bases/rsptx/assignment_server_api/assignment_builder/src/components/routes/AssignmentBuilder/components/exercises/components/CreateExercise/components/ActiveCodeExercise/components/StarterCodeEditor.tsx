import { FC } from "react";

import { CodeHighlighter } from "../../../shared/CodeHighlighter";

interface StarterCodeEditorProps {
  starterCode: string;
  onChange: (code: string) => void;
  language: string;
}

export const StarterCodeEditor: FC<StarterCodeEditorProps> = ({
  starterCode,
  onChange,
  language
}) => {
  return (
    <CodeHighlighter
      code={starterCode}
      language={language}
      onChange={onChange}
      height="400px"
      placeholder="Enter starter code for students…"
      ariaLabel="Starter code"
    />
  );
};
