import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { Button } from "primereact/button";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { InputText } from "primereact/inputtext";
import { Tooltip } from "primereact/tooltip";
import React, { FC, useRef, useCallback, useMemo, useState, useEffect, CSSProperties } from "react";

import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { ParsonsCodeHighlighter } from "./ParsonsCodeHighlighter";

interface BlockItemProps {
  block: ParsonsBlock;
  language: string;
  isDragging?: boolean;
  indentWidth: number;
  maxIndent: number;
  blockWidth: number;
  onContentChange: (id: string, content: string) => void;
  onRemove: (id: string) => void;
  onAddAlternative?: (id: string) => void;
  onCorrectChange?: (id: string, isCorrect: boolean) => void;
  onSplitBlock?: (id: string, lineIndex: number) => void;
  showCorrectCheckbox?: boolean;
  hasAlternatives?: boolean;
  showAddAlternative?: boolean;
  showDragHandle?: boolean;
  style?: React.CSSProperties;
  dragHandleProps?: {
    ref?: React.RefObject<HTMLDivElement>;
    attributes?: Record<string, any>;
    listeners?: Record<string, any>;
  };
}

const LINE_HEIGHT = 18;

const MIN_EDITOR_HEIGHT = 36;

const EDITOR_PADDING = 8;

export const BlockItem: FC<BlockItemProps> = ({
  block,
  language,
  isDragging = false,
  indentWidth,
  maxIndent,
  blockWidth,
  onContentChange,
  onRemove,
  onAddAlternative,
  onCorrectChange,
  onSplitBlock,
  showCorrectCheckbox = false,
  hasAlternatives = false,
  showAddAlternative = true,
  showDragHandle = true,
  style = {},
  dragHandleProps
}) => {
  const contentRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const splitButtonContainerRef = useRef<HTMLDivElement>(null);

  const [editorHeight, setEditorHeight] = useState<number>(MIN_EDITOR_HEIGHT);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [hoveredLineOffset, setHoveredLineOffset] = useState<number>(0);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      const tooltips = document.querySelectorAll(".p-tooltip");

      tooltips.forEach((tooltip) => {
        tooltip.classList.add("p-hidden");
      });
    };
  }, []);

  const calculateEditorHeight = useCallback((content: string) => {
    if (!content) return MIN_EDITOR_HEIGHT;

    const lineCount = content.split("\n").length;

    return Math.max(lineCount * LINE_HEIGHT + EDITOR_PADDING + LINE_HEIGHT / 2, MIN_EDITOR_HEIGHT);
  }, []);

  useEffect(() => {
    setEditorHeight(calculateEditorHeight(block.content));
  }, [block.content, calculateEditorHeight]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> | string) => {
      const newContent = typeof e === "string" ? e : e.target.value;

      onContentChange(block.id, newContent);
    },
    [block.id, onContentChange]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(block.id);
    },
    [block.id, onRemove]
  );

  const hideAllTooltips = useCallback(() => {
    const tooltips = document.querySelectorAll(".p-tooltip");

    tooltips.forEach((tooltip) => {
      tooltip.classList.add("p-hidden");
    });
  }, []);

  const handleAddAlternative = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      hideAllTooltips();

      if (onAddAlternative) {
        onAddAlternative(block.id);
      }
    },
    [block.id, onAddAlternative, hideAllTooltips]
  );

  const handleCorrectChange = useCallback(
    (e: CheckboxChangeEvent) => {
      if (onCorrectChange) {
        onCorrectChange(block.id, e.checked || false);
      }
    },
    [block.id, onCorrectChange]
  );

  const handleInputMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const isTextEditor = useMemo(() => language === "text", [language]);

  const findNearestLineBoundary = useCallback(
    (y: number, monacoEditor: Element | null): { lineIndex: number; offsetY: number } | null => {
      if (!monacoEditor) return null;

      const lines = block.content.split("\n");

      if (lines.length <= 1) return null;

      const lineElements = monacoEditor.querySelectorAll(".view-line");

      if (!lineElements || lineElements.length <= 1) return null;

      let closestLine = 0;
      let closestDistance = Infinity;
      let closestOffset = 0;

      for (let i = 0; i < lineElements.length; i++) {
        const lineElement = lineElements[i] as HTMLElement;
        const lineRect = lineElement.getBoundingClientRect();
        const lineBottom = lineRect.bottom;

        if (i < lineElements.length - 1) {
          const nextLineElement = lineElements[i + 1] as HTMLElement;
          const nextLineRect = nextLineElement.getBoundingClientRect();
          const lineBoundary = (lineBottom + nextLineRect.top) / 2;

          const distance = Math.abs(y - lineBoundary);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestLine = i + 1;
            closestOffset = lineBoundary;
          }
        }
      }

      return closestDistance < 10 ? { lineIndex: closestLine, offsetY: closestOffset } : null;
    },
    [block.content]
  );

  const handleEditorMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!editorContainerRef.current || !onSplitBlock || isDragging || hasAlternatives) return;

      setCursorPosition({ x: e.clientX, y: e.clientY });

      const container = editorContainerRef.current;
      const monacoEditor = container.querySelector(".monaco-editor");
      const tiptapEditor = container.querySelector(".ProseMirror");

      if (monacoEditor) {
        const containerRect = container.getBoundingClientRect();
        const cursorY = e.clientY;

        const boundary = findNearestLineBoundary(cursorY, monacoEditor);

        if (boundary) {
          setHoveredLine(boundary.lineIndex);

          const relativeOffset = boundary.offsetY - containerRect.top;

          setHoveredLineOffset(relativeOffset);
        } else {
          setHoveredLine(null);
        }
      } else {
        setHoveredLine(null);
      }
    },
    [findNearestLineBoundary, isDragging, onSplitBlock, hasAlternatives]
  );

  useEffect(() => {
    if (!editorContainerRef.current || hoveredLine === null) return;

    const handleScroll = () => {
      if (cursorPosition && dividerRef.current && editorContainerRef.current) {
        const container = editorContainerRef.current;
        const containerRect = container.getBoundingClientRect();

        const monacoEditor = container.querySelector(".monaco-editor");

        if (monacoEditor) {
          const boundary = findNearestLineBoundary(cursorPosition.y, monacoEditor);

          if (boundary) {
            const relativeOffset = boundary.offsetY - containerRect.top;

            setHoveredLineOffset(relativeOffset);
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [hoveredLine, cursorPosition, findNearestLineBoundary]);

  const handleEditorMouseLeave = useCallback(() => {
    setHoveredLine(null);
    setCursorPosition(null);
  }, []);

  const handleSplitBlock = useCallback(
    (lineIndex: number) => {
      if (onSplitBlock) {
        onSplitBlock(block.id, lineIndex);
      }
    },
    [block.id, onSplitBlock]
  );

  const getDividerStyle = useCallback((): CSSProperties => {
    const baseStyle: CSSProperties = {
      top: `${hoveredLineOffset}px`
    };

    if (cursorPosition) {
      return {
        ...baseStyle,
        pointerEvents: "none" as "none"
      };
    }

    return baseStyle;
  }, [hoveredLineOffset, cursorPosition]);

  const getSplitButtonContainerStyle = useCallback((): CSSProperties => {
    return { right: "0px" };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`
        flex align-items-center p-1 border-1 border-round
        ${isDragging ? "opacity-60" : ""}
        ${hasAlternatives ? "border-primary" : "border-surface-200"}
      `}
      style={{
        backgroundColor: isDragging ? "var(--surface-100)" : "var(--surface-50)",
        cursor: "default",
        position: "relative",
        width: `${blockWidth}%`,
        maxWidth: "800px",
        height: "auto",
        minHeight: "36px",
        overflow: "hidden",
        flexShrink: 0,
        ...style
      }}
    >
      {showDragHandle && dragHandleProps && (
        <div
          ref={dragHandleProps.ref}
          {...dragHandleProps.attributes}
          {...dragHandleProps.listeners}
          className="cursor-move flex align-items-center justify-content-center"
          style={{ minWidth: "20px", flexShrink: 0, marginRight: "14px" }}
        >
          <i className="pi pi-arrows-alt" style={{ fontSize: "0.875rem" }}></i>
        </div>
      )}

      <div
        className="flex align-items-center gap-1 flex-grow-1"
        style={{
          width: showDragHandle && dragHandleProps ? "calc(100% - 90px)" : "calc(100% - 50px)",
          overflow: "hidden",
          minWidth: "calc(100% - 90px)",
          flexShrink: 1
        }}
      >
        {showCorrectCheckbox && (
          <div className="flex align-items-center mr-2" style={{ flexShrink: 0 }}>
            <Tooltip target=".correct-checkbox" position="top" />
            <Checkbox
              inputId={`correct-${block.id}`}
              checked={block.isCorrect === true}
              onChange={handleCorrectChange}
              className="mr-1 correct-checkbox"
              onMouseDown={(e) => e.stopPropagation()}
              data-pr-tooltip="Correct answer"
            />
          </div>
        )}

        <div className="flex-grow-1 relative" style={{ width: "100%", overflow: "hidden" }}>
          {isTextEditor ? (
            <div
              ref={editorContainerRef}
              className="w-full relative"
              onMouseMove={handleEditorMouseMove}
              onMouseLeave={handleEditorMouseLeave}
              onMouseDown={handleInputMouseDown}
              style={{ minHeight: "36px", width: "100%" }}
            >
              <Editor
                content={block.content}
                onChange={handleContentChange}
                placeholder="Enter text content..."
              />
              {hoveredLine !== null && (
                <div ref={dividerRef} className="line-divider" style={getDividerStyle()}>
                  <div
                    ref={splitButtonContainerRef}
                    className="split-button-container"
                    style={getSplitButtonContainerStyle()}
                  >
                    <Button
                      icon="pi pi-plus"
                      onClick={() => handleSplitBlock(hoveredLine)}
                      className="p-button-rounded p-button-primary split-button"
                      aria-label="Split block"
                      pt={{
                        icon: { className: "p-button-icon" },
                        root: { className: "p-button-root" }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : language && language !== "" ? (
            <div
              ref={editorContainerRef}
              className="w-full relative"
              onMouseMove={handleEditorMouseMove}
              onMouseLeave={handleEditorMouseLeave}
              onMouseDown={handleInputMouseDown}
              style={{
                minHeight: "36px",
                width: "100%",
                overflow: "hidden",
                maxWidth: "100%"
              }}
            >
              <ParsonsCodeHighlighter
                code={block.content}
                language={language}
                onChange={handleContentChange}
                placeholder={`Enter ${language} code...`}
                className="parsons-monaco-editor"
                readOnly={false}
              />
              {hoveredLine !== null && (
                <div ref={dividerRef} className="line-divider" style={getDividerStyle()}>
                  <div
                    ref={splitButtonContainerRef}
                    className="split-button-container"
                    style={getSplitButtonContainerStyle()}
                  >
                    <Button
                      icon="pi pi-plus"
                      onClick={() => handleSplitBlock(hoveredLine)}
                      className="p-button-rounded p-button-primary split-button"
                      aria-label="Split block"
                      pt={{
                        icon: { className: "p-button-icon" },
                        root: { className: "p-button-root" }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <InputText
              ref={contentRef}
              value={block.content}
              onChange={handleContentChange as any}
              onMouseDown={handleInputMouseDown}
              className="w-full p-inputtext-sm"
              placeholder="Enter code..."
              style={{ height: "26px", maxWidth: "100%" }}
            />
          )}
        </div>

        <div className="flex gap-1" style={{ flexShrink: 0 }}>
          {onAddAlternative && showAddAlternative && (
            <>
              <Tooltip target=".add-alternative-btn" mouseTrack mouseTrackTop={10} />
              <Button
                icon="pi pi-copy"
                onClick={handleAddAlternative}
                className="p-button-rounded p-button-info p-button-text p-button-sm add-alternative-btn"
                aria-label="Add alternative block"
                data-pr-tooltip="Add alternative block"
                onMouseLeave={hideAllTooltips}
                style={{ width: "26px", height: "26px", flexShrink: 0 }}
              />
            </>
          )}
          <Button
            icon="pi pi-trash"
            onClick={handleRemove}
            className="p-button-rounded p-button-danger p-button-text p-button-sm"
            aria-label="Remove block"
            style={{ width: "26px", height: "26px", flexShrink: 0 }}
          />
        </div>
      </div>
    </div>
  );
};
