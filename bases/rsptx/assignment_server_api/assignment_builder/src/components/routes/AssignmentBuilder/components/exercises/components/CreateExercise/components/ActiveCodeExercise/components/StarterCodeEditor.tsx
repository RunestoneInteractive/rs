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
    <>
      <div
        className={`border rounded-lg overflow-hidden ${
          !starterCode ? "border-red-500" : "border-gray-300"
        }`}
      >
        <CodeHighlighter
          code={starterCode}
          language={language}
          onChange={onChange}
          height="400px"
          placeholder="Enter starter code for students..."
        />
      </div>
    </>
  );
};
