import { Editor, OnMount } from "@monaco-editor/react";
import { ActionIcon, Tooltip } from "@mantine/core";
import classNames from "classnames";
import { FC, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";

import styles from "./CodeHighlighter.module.css";

const COPY_FEEDBACK_MS = 1500;

export const MONACO_FONT_FAMILY =
  '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

interface CodeHighlighterProps {
  code: string;
  language: string;
  onChange?: (code: string) => void;
  height?: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  invalid?: boolean;
  ariaLabel?: string;
}

export const CodeHighlighter: FC<CodeHighlighterProps> = ({
  code,
  language,
  onChange,
  height = "200px",
  placeholder = "Enter code here…",
  readOnly = false,
  className,
  invalid = false,
  ariaLabel = "Code editor"
}) => {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleCopy = async () => {
    if (!navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  return (
    <div className={classNames(styles.frame, className)} data-invalid={invalid || undefined}>
      <div className={styles.headerStrip}>
        <span className={styles.languageChip}>{language}</span>
        <Tooltip label={copied ? "Copied" : "Copy code"} position="left">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label="Copy code"
            onClick={handleCopy}
            disabled={!code}
          >
            <Icon name={copied ? "check" : "copy"} size={14} />
          </ActionIcon>
        </Tooltip>
      </div>
      <div className={styles.editorArea} style={{ height }}>
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
            fontFamily: MONACO_FONT_FAMILY,
            fontLigatures: false,
            readOnly,
            tabSize: 2,
            automaticLayout: true,
            ariaLabel
          }}
        />
        {!code && !readOnly && <div className={styles.placeholder}>{placeholder}</div>}
      </div>
    </div>
  );
};
