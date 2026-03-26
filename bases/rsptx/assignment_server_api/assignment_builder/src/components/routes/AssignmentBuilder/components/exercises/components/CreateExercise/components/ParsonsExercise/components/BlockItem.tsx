import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { Button } from "primereact/button";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { Divider } from "primereact/divider";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { OverlayPanel } from "primereact/overlaypanel";
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
  onExplanationChange?: (id: string, explanation: string) => void;
  onTagChange?: (id: string, tag: string) => void;
  onDependsChange?: (id: string, depends: string[]) => void;
  onOrderChange?: (id: string, order: number) => void;
  showCorrectCheckbox?: boolean;
  hasAlternatives?: boolean;
  showAddAlternative?: boolean;
  showDragHandle?: boolean;
  isFirstInLine?: boolean;
  grader?: "line" | "dag";
  orderMode?: "random" | "custom";
  allTags?: string[];
  mode?: "simple" | "enhanced";
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
  onExplanationChange,
  onTagChange,
  onDependsChange,
  onOrderChange,
  showCorrectCheckbox = false,
  hasAlternatives = false,
  showAddAlternative = true,
  showDragHandle = true,
  isFirstInLine = false,
  grader = "line",
  orderMode = "random",
  allTags = [],
  mode = "enhanced",
  style = {},
  dragHandleProps
}) => {
  const contentRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const splitButtonContainerRef = useRef<HTMLDivElement>(null);
  const optionsPanelRef = useRef<OverlayPanel>(null);

  const [editorHeight, setEditorHeight] = useState<number>(MIN_EDITOR_HEIGHT);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [hoveredLineOffset, setHoveredLineOffset] = useState<number>(0);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(!!block.explanation);

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
      optionsPanelRef.current?.hide();
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
  const isFirstBlock = blockIndex === 0;
  // Show full options for standalone blocks or the first block in a line (alternatives)
  const showOptions = isStandalone || isFirstInLine;
  const isSimple = mode === "simple";
  const showDagFields = grader === "dag" && !block.isDistractor && showOptions;
  const showOrderField = orderMode === "custom" && showOptions;
  const showDistractorToggle = showOptions && !!onDistractorChange;

  // Determine if there are any options to show in the popover (never in simple mode)
  const hasPopoverOptions = !isSimple && (
    showDistractorToggle ||
    showDagFields ||
    showOrderField ||
    (onExplanationChange && showOptions) ||
    (onAddAlternative && showAddAlternative && showOptions)
  );

  // In simple mode, show inline controls for distractor, alternative, note
  const showInlineDistractor = isSimple && showDistractorToggle;
  const showInlineAlternative = isSimple && onAddAlternative && showAddAlternative && showOptions;
  const showInlineExplanation = isSimple && onExplanationChange && showOptions;
  const showInlinePaired = isSimple && onPairedChange && !isFirstBlock && block.isDistractor;

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

  // Render the options popover content
  const renderOptionsPanel = () => (
    <div className={styles.optionsPanel} onMouseDown={(e) => e.stopPropagation()}>
      {/* Block type section — Toggle switch */}
      {showDistractorToggle && (
        <div className={styles.optionsPanelSection}>
          <span className={styles.optionsPanelSectionTitle}>Block Type</span>
          <div className={styles.blockTypeToggleWrapper}>
            <div
              className={styles.blockTypeToggle}
              data-tour={blockIndex === 0 ? "block-type-toggle" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                const newIsDistractor = !block.isDistractor;
                onDistractorChange!(block.id, newIsDistractor);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              role="switch"
              aria-checked={block.isDistractor}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const newIsDistractor = !block.isDistractor;
                  onDistractorChange!(block.id, newIsDistractor);
                }
              }}
            >
              <span
                className={`${styles.blockTypeToggleLabel} ${!block.isDistractor ? styles.blockTypeToggleLabelActive : ""}`}
              >
                <i className="pi pi-check-circle" />
                Solution
              </span>
              <span
                className={`${styles.blockTypeToggleLabel} ${block.isDistractor ? styles.blockTypeToggleLabelActive : ""}`}
              >
                <i className="pi pi-times-circle" />
                Distractor
              </span>
              <div
                className={`${styles.blockTypeToggleSlider} ${block.isDistractor ? styles.blockTypeToggleSliderRight : ""}`}
              />
            </div>
          </div>

          {/* Paired checkbox — only visible when NOT the first block */}
          {onPairedChange && !isFirstBlock && (
            <div className={styles.pairedCheckboxRow}>
              <Checkbox
                inputId={`paired-${block.id}`}
                checked={block.isDistractor === true && block.pairedWithBlockAbove === true}
                onChange={(e) => {
                  const paired = e.checked ?? false;
                  if (paired && !block.isDistractor) {
                    onDistractorChange!(block.id, true);
                  }
                  onPairedChange(block.id, paired);
                }}
                className={styles.modernCheckbox}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <label
                htmlFor={`paired-${block.id}`}
                className={styles.pairedCheckboxLabel}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <i className="pi pi-link" />
                Pair with block above
              </label>
            </div>
          )}
        </div>
      )}

      {/* DAG fields section */}
      {showDagFields && (onTagChange || onDependsChange) && (
        <>
          {showDistractorToggle && <Divider className={styles.optionsPanelDivider} />}
          <div className={styles.optionsPanelSection} data-tour={blockIndex === 0 ? "dag-config" : undefined}>
            <span className={styles.optionsPanelSectionTitle}>DAG Configuration</span>
            {onTagChange && (
              <div className={styles.optionsPanelField}>
                <label className={styles.optionsPanelLabel}>Tag</label>
                <InputText
                  value={block.tag || ""}
                  onChange={(e) => onTagChange(block.id, e.target.value)}
                  className={styles.optionsPanelInput}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder={`${blockIndex ?? 0}`}
                />
              </div>
            )}
            {onDependsChange && (
              <div className={styles.optionsPanelField}>
                <label className={styles.optionsPanelLabel}>
                  Depends on
                  {allTags.length > 0 && (
                    <span className={styles.optionsPanelHint}>
                      ({allTags.filter((t) => t !== block.tag).join(", ")})
                    </span>
                  )}
                </label>
                <InputText
                  value={block.depends?.join(", ") || ""}
                  onChange={(e) => {
                    const deps = e.target.value
                      .split(",")
                      .map((d) => d.trim())
                      .filter((d) => d !== "");
                    onDependsChange(block.id, deps);
                  }}
                  className={styles.optionsPanelInput}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder="e.g. 0, 1"
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Order field section */}
      {showOrderField && onOrderChange && (
        <>
          {(showDistractorToggle || showDagFields) && (
            <Divider className={styles.optionsPanelDivider} />
          )}
          <div className={styles.optionsPanelSection} data-tour={blockIndex === 0 ? "position-field" : undefined}>
            <span className={styles.optionsPanelSectionTitle}>Display Order</span>
            <div className={styles.optionsPanelField}>
              <label className={styles.optionsPanelLabel}>Position</label>
              <InputText
                value={block.displayOrder !== undefined ? String(block.displayOrder) : ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onOrderChange(block.id, isNaN(val) ? 0 : val);
                }}
                className={styles.optionsPanelInput}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Auto"
              />
            </div>
          </div>
        </>
      )}

      {/* Actions section */}
      {((onExplanationChange && showOptions) || (onAddAlternative && showAddAlternative && showOptions)) && (
        <>
          {(showDistractorToggle || showDagFields || showOrderField) && (
            <Divider className={styles.optionsPanelDivider} />
          )}
          <div className={styles.optionsPanelSection}>
            {onAddAlternative && showAddAlternative && showOptions && (
              <button
                className={styles.optionsPanelAction}
                onClick={handleAddAlternative}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <i className="pi pi-copy" />
                <span>Add Alternative</span>
              </button>
            )}
            {onExplanationChange && showOptions && (
              <button
                className={styles.optionsPanelAction}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExplanation(!showExplanation);
                  optionsPanelRef.current?.hide();
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <i className="pi pi-comment" />
                <span>{showExplanation ? "Hide Explanation" : "Add Explanation"}</span>
                {block.explanation && <span className={styles.optionsPanelBadge}>1</span>}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={styles.blockCard}
      style={{
        width: `${blockWidth}%`,
        maxWidth: "800px",
        flexShrink: 0,
        opacity: isDragging ? 0.5 : 1,
        ...style
      }}
    >
      {/* Main block row */}
      <div
        className={`${styles.blockRow} ${block.isDistractor ? styles.blockRowDistractor : ""}`}
        style={showExplanation ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : undefined}
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
            title="Drag to reorder"
            data-tour={blockIndex === 0 ? "drag-handle" : undefined}
          >
            <i className="pi pi-bars" />
          </div>
        )}

        {/* Block number badge */}
        {blockIndex !== undefined && isStandalone && (
          <div className={styles.blockNum}>{blockIndex + 1}</div>
        )}

        {/* Inline distractor toggle — Simple mode only */}
        {showInlineDistractor && (
          <div className={styles.inlineDistractorArea}>
            <Tooltip target=".inline-distractor-pill" position="top" />
            <div
              className={`${styles.inlineDistractorPill} ${block.isDistractor ? styles.inlineDistractorPillActive : ""} inline-distractor-pill`}
              data-tour={blockIndex === 0 ? "distractor-pill" : undefined}
              data-pr-tooltip={block.isDistractor ? "Distractor block" : "Solution block"}
              onClick={(e) => {
                e.stopPropagation();
                onDistractorChange!(block.id, !block.isDistractor);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              role="switch"
              aria-checked={block.isDistractor}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDistractorChange!(block.id, !block.isDistractor);
                }
              }}
            >
              {block.isDistractor ? "D" : "S"}
            </div>
            {/* Inline paired checkbox */}
            {showInlinePaired && (
              <div className={styles.inlinePairedWrapper}>
                <Tooltip target=".inline-paired-check" position="top" />
                <Checkbox
                  inputId={`paired-inline-${block.id}`}
                  checked={block.isDistractor === true && block.pairedWithBlockAbove === true}
                  onChange={(e) => {
                    const paired = e.checked ?? false;
                    if (paired && !block.isDistractor) {
                      onDistractorChange!(block.id, true);
                    }
                    onPairedChange!(block.id, paired);
                  }}
                  className={`${styles.modernCheckbox} inline-paired-check`}
                  data-pr-tooltip="Pair with block above"
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ width: "0.85rem", height: "0.85rem" }}
                />
              </div>
            )}
          </div>
        )}

        {/* Correct checkbox for alternatives */}
        {showCorrectCheckbox && (
          <div className={styles.correctCheckboxWrapper}>
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

        {/* Editor area */}
        <div className={styles.blockEditor}>{renderEditor()}</div>

        {/* Compact action bar — replaces old inlineMeta + blockActions */}
        <div className={styles.blockActions}>
          {/* Options menu trigger — Enhanced mode only */}
          {hasPopoverOptions && (
            <>
              <Button
                icon="pi pi-ellipsis-v"
                onClick={(e) => {
                  e.stopPropagation();
                  optionsPanelRef.current?.toggle(e);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={`p-button-rounded p-button-text ${styles.actionBtn}`}
                aria-label="Block options"
              />
              <OverlayPanel ref={optionsPanelRef} className={styles.optionsPanelOverlay}>
                {renderOptionsPanel()}
              </OverlayPanel>
            </>
          )}
          {/* Inline alternative button — Simple mode only */}
          {showInlineAlternative && (
            <Button
              icon="pi pi-copy"
              onClick={handleAddAlternative}
              onMouseDown={(e) => e.stopPropagation()}
              className={`p-button-rounded p-button-text ${styles.actionBtn}`}
              aria-label="Add alternative"
              tooltip="Add alternative"
              tooltipOptions={{ position: "top" }}
            />
          )}
          {/* Inline explanation button — Simple mode only */}
          {showInlineExplanation && (
            <Button
              icon="pi pi-comment"
              onClick={(e) => {
                e.stopPropagation();
                setShowExplanation(!showExplanation);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`p-button-rounded p-button-text ${styles.actionBtn} ${block.explanation ? styles.actionBtnHighlight : ""}`}
              aria-label={showExplanation ? "Hide explanation" : "Add explanation"}
              tooltip={showExplanation ? "Hide explanation" : "Add explanation"}
              tooltipOptions={{ position: "top" }}
            />
          )}
          {/* Remove — always visible */}
          <Button
            icon="pi pi-trash"
            onClick={handleRemove}
            className={`p-button-rounded p-button-text ${styles.actionBtn} ${styles.actionBtnDanger}`}
            aria-label="Remove block"
          />
        </div>
      </div>

      {/* Explanation row — appears below the main row when toggled */}
      {showExplanation && onExplanationChange && (
        <div className={styles.explanationRow} data-tour={blockIndex === 0 ? "explanation-row" : undefined}>
          <i className={`pi pi-comment ${styles.explanationIcon}`} />
          <InputTextarea
            value={block.explanation || ""}
            onChange={(e) => onExplanationChange(block.id, e.target.value)}
            className={styles.explanationInput}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Block explanation (shown to students after solving)..."
            autoResize
            rows={1}
          />
        </div>
      )}
    </div>
  );
};
