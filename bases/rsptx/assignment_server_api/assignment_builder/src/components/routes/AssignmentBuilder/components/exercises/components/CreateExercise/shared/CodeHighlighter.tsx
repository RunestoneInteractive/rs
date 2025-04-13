import { Editor } from "@monaco-editor/react";
import { classNames } from "primereact/utils";
import { FC, useRef } from "react";

interface CodeHighlighterProps {
  code: string;
  language: string;
  onChange?: (code: string) => void;
  height?: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

export const CodeHighlighter: FC<CodeHighlighterProps> = ({
  code,
  language,
  onChange,
  height = "200px",
  placeholder = "Enter code here...",
  readOnly = false,
  className
}) => {
  const editorRef = useRef(null);

  // Map language values to Monaco editor language identifiers
  const getMonacoLanguage = (lang: string): string => {
    const languageMap: Record<string, string> = {
      python: "python",
      javascript: "javascript",
      java: "java",
      cpp: "cpp",
      c: "c",
      sql: "sql",
      html: "html",
      css: "css"
    };

    return languageMap[lang] || "plaintext";
  };

  // Handle editor mount
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  return (
    <div className={classNames("code-highlighter", className)} style={{ height }}>
      <Editor
        value={code}
        language={getMonacoLanguage(language)}
        onChange={(value) => onChange?.(value || "")}
        onMount={handleEditorDidMount}
        height={height}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          readOnly,
          tabSize: 2,
          automaticLayout: true
        }}
      />
      {!code && !readOnly && (
        <div
          className="placeholder"
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            color: "#ccc",
            pointerEvents: "none"
          }}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
};
