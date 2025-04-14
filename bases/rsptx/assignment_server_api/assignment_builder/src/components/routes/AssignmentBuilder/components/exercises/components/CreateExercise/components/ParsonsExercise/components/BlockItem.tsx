import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { Button } from "primereact/button";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { InputText } from "primereact/inputtext";
import { Tooltip } from "primereact/tooltip";
import React, { FC, useRef, useCallback, useMemo, useState, useEffect } from "react";

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

// Height per line of code (in pixels)
const LINE_HEIGHT = 18;
// Minimum height for the editor
const MIN_EDITOR_HEIGHT = 36;
// Additional padding for the editor
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
  showCorrectCheckbox = false,
  hasAlternatives = false,
  showAddAlternative = true,
  showDragHandle = true,
  style = {},
  dragHandleProps
}) => {
  const contentRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State to track the editor height
  const [editorHeight, setEditorHeight] = useState<number>(MIN_EDITOR_HEIGHT);

  // Manage tooltips to prevent stuck tooltips
  useEffect(() => {
    // cleanup function to handle tooltip hiding when component unmounts
    return () => {
      // Find and hide all tooltips that might be associated with this component
      const tooltips = document.querySelectorAll(".p-tooltip");

      tooltips.forEach((tooltip) => {
        tooltip.classList.add("p-hidden");
      });
    };
  }, []);

  // Calculate editor height based on content
  const calculateEditorHeight = useCallback((content: string) => {
    if (!content) return MIN_EDITOR_HEIGHT;

    // Count number of lines
    const lineCount = content.split("\n").length;

    // Calculate height based on line count with minimum height
    return Math.max(lineCount * LINE_HEIGHT + EDITOR_PADDING + LINE_HEIGHT / 2, MIN_EDITOR_HEIGHT);
  }, []);

  // Update editor height when content changes
  useEffect(() => {
    setEditorHeight(calculateEditorHeight(block.content));
  }, [block.content, calculateEditorHeight]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> | string) => {
      // Handle both string (from editors) and event (from InputText)
      const newContent = typeof e === "string" ? e : e.target.value;

      onContentChange(block.id, newContent);
    },
    [block.id, onContentChange]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      // Stop propagation to prevent drag start
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
      // Hide any visible tooltips
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

  // Prevent dragging when clicking in the input field
  const handleInputMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Determine if we should use text editor (TipTap) or code editor (Monaco)
  const isTextEditor = useMemo(() => language === "text", [language]);

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
        cursor: "default", // Change cursor to default since only handle is draggable
        position: "relative",
        width: `${blockWidth}%`, // Set width as percentage of parent container
        maxWidth: "800px",
        height: "auto", // Allow height to adjust based on content
        minHeight: "36px", // Minimum height for the block
        overflow: "hidden", // Prevent content overflow
        flexShrink: 0, // Prevent shrinking during drag
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

        <div className="flex-grow-1" style={{ width: "100%", overflow: "hidden" }}>
          {isTextEditor ? (
            <div
              className="w-full"
              onMouseDown={handleInputMouseDown}
              style={{ minHeight: "36px", width: "100%" }}
            >
              <Editor
                content={block.content}
                onChange={handleContentChange}
                placeholder="Enter text content..."
              />
            </div>
          ) : language && language !== "" ? (
            <div
              className="w-full"
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
            </div>
          ) : (
            <InputText
              ref={contentRef}
              value={block.content}
              onChange={handleContentChange as any}
              onMouseDown={handleInputMouseDown}
              className="w-full p-inputtext-sm"
              placeholder="Enter code..."
              style={{ height: "26px", maxWidth: "100%" }} // Make input smaller
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
            style={{ width: "26px", height: "26px", flexShrink: 0 }} // Make button smaller
          />
        </div>
      </div>
    </div>
  );
};
