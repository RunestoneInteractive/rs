import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { Button } from "primereact/button";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tooltip } from "primereact/tooltip";
import React, { FC, useRef, useCallback, useMemo, useState, useEffect, CSSProperties } from "react";

import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { ParsonsCodeHighlighter } from "./ParsonsCodeHighlighter";
import styles from "./ParsonsExercise.module.css";

interface BlockItemProps {
  block: ParsonsBlock;
  language: string;
  isDragging?: boolean;
  indentWidth: number;
  maxIndent: number;
  blockWidth: number;
  blockIndex?: number;
  onContentChange: (id: string, content: string) => void;
  onRemove: (id: string) => void;
  onAddAlternative?: (id: string) => void;
  onCorrectChange?: (id: string, isCorrect: boolean) => void;
  onSplitBlock?: (id: string, lineIndex: number) => void;
  onDistractorChange?: (id: string, isDistractor: boolean) => void;
  onPairedChange?: (id: string, paired: boolean) => void;
  onCommentChange?: (id: string, comment: string) => void;
  onTagChange?: (id: string, tag: string) => void;
  onDependsChange?: (id: string, depends: string[]) => void;
  onOrderChange?: (id: string, order: number) => void;
  showCorrectCheckbox?: boolean;
  hasAlternatives?: boolean;
  showAddAlternative?: boolean;
  showDragHandle?: boolean;
  grader?: "line" | "dag";
  orderMode?: "random" | "custom";
  allTags?: string[];
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
  blockIndex,
  onContentChange,
  onRemove,
  onAddAlternative,
  onCorrectChange,
  onSplitBlock,
  onDistractorChange,
  onPairedChange,
  onCommentChange,
  onTagChange,
  onDependsChange,
  onOrderChange,
  showCorrectCheckbox = false,
  hasAlternatives = false,
  showAddAlternative = true,
  showDragHandle = true,
  grader = "line",
  orderMode = "random",
  allTags = [],
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
  const [showComment, setShowComment] = useState<boolean>(!!block.comment);

  useEffect(() => {
    return () => {
      document.querySelectorAll(".p-tooltip").forEach((t) => t.classList.add("p-hidden"));
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
    document.querySelectorAll(".p-tooltip").forEach((t) => t.classList.add("p-hidden"));
  }, []);

  const handleAddAlternative = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      hideAllTooltips();
      if (onAddAlternative) onAddAlternative(block.id);
    },
    [block.id, onAddAlternative, hideAllTooltips]
  );

  const handleCorrectChange = useCallback(
    (e: CheckboxChangeEvent) => {
      if (onCorrectChange) onCorrectChange(block.id, e.checked || false);
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
        const lineRect = (lineElements[i] as HTMLElement).getBoundingClientRect();
        if (i < lineElements.length - 1) {
          const nextRect = (lineElements[i + 1] as HTMLElement).getBoundingClientRect();
          const boundary = (lineRect.bottom + nextRect.top) / 2;
          const distance = Math.abs(y - boundary);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestLine = i + 1;
            closestOffset = boundary;
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
      if (monacoEditor) {
        const containerRect = container.getBoundingClientRect();
        const boundary = findNearestLineBoundary(e.clientY, monacoEditor);
        if (boundary) {
          setHoveredLine(boundary.lineIndex);
          setHoveredLineOffset(boundary.offsetY - containerRect.top);
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
        const monacoEditor = container.querySelector(".monaco-editor");
        if (monacoEditor) {
          const boundary = findNearestLineBoundary(cursorPosition.y, monacoEditor);
          if (boundary) {
            setHoveredLineOffset(boundary.offsetY - container.getBoundingClientRect().top);
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [hoveredLine, cursorPosition, findNearestLineBoundary]);

  const handleEditorMouseLeave = useCallback(() => {
    setHoveredLine(null);
    setCursorPosition(null);
  }, []);

  const handleSplitBlock = useCallback(
    (lineIndex: number) => {
      if (onSplitBlock) onSplitBlock(block.id, lineIndex);
    },
    [block.id, onSplitBlock]
  );

  const getDividerStyle = useCallback((): CSSProperties => {
    const base: CSSProperties = { top: `${hoveredLineOffset}px` };
    return cursorPosition ? { ...base, pointerEvents: "none" as "none" } : base;
  }, [hoveredLineOffset, cursorPosition]);

  const getSplitButtonContainerStyle = useCallback((): CSSProperties => {
    return { right: "0px" };
  }, []);

  // Determine strip color
  const stripClass = block.isDistractor
    ? block.pairedWithBlockAbove
      ? styles.stripPaired
      : styles.stripDistractor
    : hasAlternatives
      ? styles.stripAlternative
      : styles.stripSolution;

  const isStandalone = !hasAlternatives;
  const showDagFields = grader === "dag" && !block.isDistractor && isStandalone;
  const showOrderField = orderMode === "custom" && isStandalone;
  const showDistractorToggle = isStandalone && !!onDistractorChange;

  // Render split line overlay
  const renderSplitOverlay = () => {
    if (hoveredLine === null) return null;
    return (
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
    );
  };

  // Render the code editor
  const renderEditor = () => {
    if (isTextEditor) {
      return (
        <div
          ref={editorContainerRef}
          className="w-full relative"
          onMouseMove={handleEditorMouseMove}
          onMouseLeave={handleEditorMouseLeave}
          onMouseDown={handleInputMouseDown}
          style={{ minHeight: "32px", width: "100%" }}
        >
          <Editor content={block.content} onChange={handleContentChange} />
          {renderSplitOverlay()}
        </div>
      );
    }
    if (language && language !== "") {
      return (
        <div
          ref={editorContainerRef}
          className="w-full relative"
          onMouseMove={handleEditorMouseMove}
          onMouseLeave={handleEditorMouseLeave}
          onMouseDown={handleInputMouseDown}
          style={{ minHeight: "32px", width: "100%", overflow: "hidden" }}
        >
          <ParsonsCodeHighlighter
            code={block.content}
            language={language}
            onChange={handleContentChange}
            placeholder={`Enter ${language} code...`}
            className="parsons-monaco-editor"
            readOnly={false}
          />
          {renderSplitOverlay()}
        </div>
      );
    }
    return (
      <InputText
        ref={contentRef}
        value={block.content}
        onChange={handleContentChange as any}
        onMouseDown={handleInputMouseDown}
        className="w-full p-inputtext-sm"
        placeholder="Enter code..."
        style={{ height: "24px", maxWidth: "100%", fontSize: "0.85rem" }}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: `${blockWidth}%`,
        maxWidth: "800px",
        flexShrink: 0,
        opacity: isDragging ? 0.5 : 1,
        ...style
      }}
    >
      {/* Main row */}
      <div
        className={`${styles.blockRow} ${block.isDistractor ? styles.blockRowDistractor : ""}`}
        style={showComment ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : undefined}
      >
        {/* Color strip */}
        <div className={`${styles.blockStrip} ${stripClass}`} />

        {/* Drag handle */}
        {showDragHandle && dragHandleProps && (
          <div
            ref={dragHandleProps.ref}
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
            className={styles.dragHandle}
          >
            <i className="pi pi-bars" />
          </div>
        )}

        {/* Block number */}
        {blockIndex !== undefined && isStandalone && (
          <div className={styles.blockNum}>{blockIndex + 1}</div>
        )}

        {/* Correct checkbox for alternatives */}
        {showCorrectCheckbox && (
          <div style={{ display: "flex", alignItems: "center", padding: "0 4px", flexShrink: 0 }}>
            <Tooltip target=".correct-checkbox" position="top" />
            <Checkbox
              inputId={`correct-${block.id}`}
              checked={block.isCorrect === true}
              onChange={handleCorrectChange}
              className="correct-checkbox"
              onMouseDown={(e) => e.stopPropagation()}
              data-pr-tooltip="Correct answer"
              style={{ width: "1rem", height: "1rem" }}
            />
          </div>
        )}

        {/* Editor */}
        <div className={styles.blockEditor}>{renderEditor()}</div>

        {/* Inline meta fields */}
        {(showDistractorToggle || showDagFields || showOrderField) && (
          <div className={styles.inlineMeta}>
            {/* Distractor toggle chip */}
            {showDistractorToggle && (
              <button
                className={`${styles.distractorChip} ${
                  block.isDistractor ? styles.isDistractor : styles.isSolution
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDistractorChange!(block.id, !block.isDistractor);
                  // Reset paired when turning off distractor
                  if (block.isDistractor && onPairedChange) {
                    onPairedChange(block.id, false);
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title={block.isDistractor ? "Mark as solution block" : "Mark as distractor"}
              >
                <i
                  className={`pi ${block.isDistractor ? "pi-times" : "pi-check"}`}
                  style={{ fontSize: "0.55rem" }}
                />
                {block.isDistractor ? "D" : "S"}
              </button>
            )}

            {/* Paired toggle — only shown for distractor blocks */}
            {showDistractorToggle && block.isDistractor && onPairedChange && (
              <button
                className={`${styles.pairedChip} ${
                  block.pairedWithBlockAbove ? styles.isPaired : styles.isUnpaired
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onPairedChange(block.id, !block.pairedWithBlockAbove);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title={
                  block.pairedWithBlockAbove
                    ? "Unpair from block above (will become a free distractor)"
                    : "Pair with block above (always shown together, student must choose)"
                }
              >
                <i className="pi pi-link" style={{ fontSize: "0.55rem" }} />P
              </button>
            )}

            {/* Order */}
            {showOrderField && onOrderChange && (
              <div className={styles.inlineField}>
                <span className={styles.inlineFieldLabel}>#</span>
                <InputText
                  value={block.displayOrder !== undefined ? String(block.displayOrder) : ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    onOrderChange(block.id, isNaN(val) ? 0 : val);
                  }}
                  className={styles.orderInlineInput}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="—"
                />
              </div>
            )}

            {/* DAG tag */}
            {showDagFields && onTagChange && (
              <div className={styles.inlineField}>
                <span className={styles.inlineFieldLabel}>tag</span>
                <InputText
                  value={block.tag || ""}
                  onChange={(e) => onTagChange(block.id, e.target.value)}
                  className={styles.tagInlineInput}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder={`${blockIndex ?? 0}`}
                />
              </div>
            )}

            {/* DAG depends */}
            {showDagFields && onDependsChange && (
              <div className={styles.inlineField}>
                <span className={styles.inlineFieldLabel}>dep</span>
                <Tooltip
                  target={`.depends-input-${block.id}`}
                  position="top"
                  mouseTrack
                  mouseTrackTop={10}
                />
                <InputText
                  value={block.depends?.join(",") || ""}
                  onChange={(e) => {
                    const deps = e.target.value
                      .split(",")
                      .map((d) => d.trim())
                      .filter((d) => d !== "");
                    onDependsChange(block.id, deps);
                  }}
                  className={`${styles.dependsInlineInput} depends-input-${block.id}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="0,1"
                  data-pr-tooltip={
                    allTags.length > 0
                      ? `Available: ${allTags.filter((t) => t !== block.tag).join(", ")}`
                      : undefined
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className={styles.blockActions}>
          {/* Comment toggle */}
          {onCommentChange && isStandalone && (
            <Button
              icon="pi pi-comment"
              onClick={(e) => {
                e.stopPropagation();
                setShowComment(!showComment);
              }}
              className={`p-button-rounded p-button-text ${styles.tinyBtn}`}
              aria-label="Toggle comment"
              style={{ color: block.comment ? "#f59e0b" : "#94a3b8" }}
            />
          )}
          {/* Add alternative */}
          {onAddAlternative && showAddAlternative && (
            <>
              <Tooltip target=".add-alt-btn" mouseTrack mouseTrackTop={10} />
              <Button
                icon="pi pi-copy"
                onClick={handleAddAlternative}
                className={`p-button-rounded p-button-info p-button-text add-alt-btn ${styles.tinyBtn}`}
                aria-label="Add alternative"
                data-pr-tooltip="Add alternative"
                onMouseLeave={hideAllTooltips}
              />
            </>
          )}
          {/* Remove */}
          <Button
            icon="pi pi-trash"
            onClick={handleRemove}
            className={`p-button-rounded p-button-danger p-button-text ${styles.tinyBtn}`}
            aria-label="Remove"
          />
        </div>
      </div>

      {/* Comment row — appears below the main row when toggled */}
      {showComment && onCommentChange && (
        <div
          className={styles.commentRow}
          style={{
            border: "1px solid #e2e8f0",
            borderTop: "none",
            borderBottomLeftRadius: "5px",
            borderBottomRightRadius: "5px"
          }}
        >
          <InputTextarea
            value={block.comment || ""}
            onChange={(e) => onCommentChange(block.id, e.target.value)}
            className={styles.commentInput}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Author note (not shown to students)..."
            autoResize
            rows={1}
          />
        </div>
      )}
    </div>
  );
};
