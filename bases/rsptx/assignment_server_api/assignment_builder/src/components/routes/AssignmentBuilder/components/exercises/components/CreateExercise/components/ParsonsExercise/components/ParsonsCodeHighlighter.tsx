import { Editor } from "@monaco-editor/react";
import { classNames } from "primereact/utils";
import { FC, useRef, useEffect, useState } from "react";

import "../ParsonsStyles.css";

interface ParsonsCodeHighlighterProps {
  code: string;
  language: string;
  onChange?: (code: string) => void;
  height?: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

export const ParsonsCodeHighlighter: FC<ParsonsCodeHighlighterProps> = ({
  code,
  language,
  onChange,
  height = "36px",
  placeholder = "Enter code here...",
  readOnly = false,
  className
}) => {
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const updateEditorLayout = () => {
      if (editorRef.current) {
        setTimeout(() => {
          editorRef.current.layout();
        }, 10);
      }
    };

    window.addEventListener("resize", updateEditorLayout);

    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        updateEditorLayout();
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        window.removeEventListener("resize", updateEditorLayout);
        resizeObserver.disconnect();
      };
    }

    return () => {
      window.removeEventListener("resize", updateEditorLayout);
    };
  }, []);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    editor.onDidContentSizeChange(() => {
      const contentHeight = Math.min(Math.max(editor.getContentHeight(), 36), 500);

      const container = containerRef.current;

      if (container) {
        container.style.height = `${contentHeight}px`;
        editor.layout();
      }
    });

    editor.layout();
  };

  const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 768;

  if (isSmallScreen) {
    return (
      <div
        ref={containerRef}
        className={classNames("parsons-editor-textarea", className)}
        style={{ width: "100%", height }}
      >
        <textarea
          value={code}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          className="w-full h-full p-1 font-mono text-sm border-none"
          style={{ resize: "none", minHeight: "36px" }}
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={classNames("code-highlighter parsons-editor", className)}
      style={{ width: "100%", height, maxWidth: "100%" }}
    >
      <Editor
        value={code}
        language={getMonacoLanguage(language)}
        onChange={(value) => onChange?.(value || "")}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 16,
          readOnly,
          tabSize: 4,
          automaticLayout: true,
          lineNumbers: "off",
          folding: false,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0,
          scrollbar: {
            vertical: "hidden",
            horizontal: "hidden",
            verticalScrollbarSize: 0,
            horizontalScrollbarSize: 0
          },
          overviewRulerBorder: false,
          overviewRulerLanes: 0,
          cursorStyle: "line",
          cursorWidth: 1,
          renderLineHighlight: "none",
          contextmenu: false,
          wordWrap: "on",
          padding: { top: 8, bottom: 4 },
          hover: { enabled: false },
          quickSuggestions: false,
          parameterHints: { enabled: false },
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnEnter: "off",
          snippetSuggestions: "none",
          suggest: {
            showWords: false,
            showFunctions: false,
            showClasses: false,
            showInterfaces: false,
            showConstructors: false,
            showModules: false,
            showProperties: false,
            showEvents: false,
            showOperators: false,
            showUnits: false,
            showValues: false,
            showConstants: false,
            showEnums: false,
            showEnumMembers: false,
            showKeywords: false,
            showTypeParameters: false
          }
        }}
        className="parsons-monaco-instance"
      />
    </div>
  );
};
