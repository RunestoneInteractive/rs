import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import {
  ActionIcon,
  Checkbox,
  Divider,
  Popover,
  TextInput,
  Textarea,
  Tooltip
} from "@mantine/core";
import React, { FC, useRef, useCallback, useMemo, useState, useEffect, CSSProperties } from "react";

import { Icon } from "@/components/ui/Icon";
import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { REMOVE_BLOCK_CONFIRM, confirmRemoval } from "../../../utils/removeConfirm";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attributes?: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const [optionsOpened, setOptionsOpened] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [editorHeight, setEditorHeight] = useState<number>(MIN_EDITOR_HEIGHT);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [hoveredLineOffset, setHoveredLineOffset] = useState<number>(0);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(!!block.explanation);

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
      confirmRemoval({
        hasContent: Boolean(block.content.trim() || block.explanation?.trim()),
        ...REMOVE_BLOCK_CONFIRM,
        onConfirm: () => onRemove(block.id)
      });
    },
    [block.id, block.content, block.explanation, onRemove]
  );

  const handleAddAlternative = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setOptionsOpened(false);
      if (onAddAlternative) onAddAlternative(block.id);
    },
    [block.id, onAddAlternative]
  );

  const handleCorrectChange = useCallback(
    (checked: boolean) => {
      if (onCorrectChange) onCorrectChange(block.id, checked);
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
    return cursorPosition ? { ...base, pointerEvents: "none" as const } : base;
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
  const hasPopoverOptions =
    !isSimple &&
    (showDistractorToggle ||
      showDagFields ||
      showOrderField ||
      (onExplanationChange && showOptions) ||
      (onAddAlternative && showAddAlternative && showOptions));

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
          <ActionIcon
            radius="xl"
            size="sm"
            onClick={() => handleSplitBlock(hoveredLine)}
            className="split-button"
            aria-label="Split block"
          >
            <Icon name="plus" size={14} />
          </ActionIcon>
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
            placeholder={`Enter ${language} code…`}
            className="parsons-monaco-editor"
            readOnly={false}
            ariaLabel={`Code for block ${(blockIndex ?? 0) + 1}`}
          />
          {renderSplitOverlay()}
        </div>
      );
    }
    return (
      <TextInput
        ref={contentRef}
        value={block.content}
        onChange={handleContentChange as React.ChangeEventHandler<HTMLInputElement>}
        onMouseDown={handleInputMouseDown}
        size="xs"
        placeholder="Enter code…"
        style={{ width: "100%", maxWidth: "100%" }}
      />
    );
  };

  // Render the options popover content
  const renderOptionsPanel = () => (
    <div className={styles.optionsPanel} onMouseDown={(e) => e.stopPropagation()}>
      {/* Block type section — Toggle switch */}
      {showDistractorToggle && (
        <div className={styles.optionsPanelSection}>
          <span className={styles.optionsPanelSectionTitle}>Block type</span>
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
                <Icon name="check-circle" size={14} />
                Solution
              </span>
              <span
                className={`${styles.blockTypeToggleLabel} ${block.isDistractor ? styles.blockTypeToggleLabelActive : ""}`}
              >
                <Icon name="times-circle" size={14} />
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
                id={`paired-${block.id}`}
                checked={block.isDistractor === true && block.pairedWithBlockAbove === true}
                onChange={(e) => {
                  const paired = e.currentTarget.checked;
                  if (paired && !block.isDistractor) {
                    onDistractorChange!(block.id, true);
                  }
                  onPairedChange(block.id, paired);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                label={
                  <span className={styles.pairedCheckboxLabel}>
                    <Icon name="link" size={14} />
                    Pair with block above
                  </span>
                }
              />
            </div>
          )}
        </div>
      )}

      {/* DAG fields section */}
      {showDagFields && (onTagChange || onDependsChange) && (
        <>
          {showDistractorToggle && <Divider className={styles.optionsPanelDivider} />}
          <div
            className={styles.optionsPanelSection}
            data-tour={blockIndex === 0 ? "dag-config" : undefined}
          >
            <span className={styles.optionsPanelSectionTitle}>DAG configuration</span>
            {onTagChange && (
              <div className={styles.optionsPanelField}>
                <label className={styles.optionsPanelLabel}>Tag</label>
                <TextInput
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
                <TextInput
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
          <div
            className={styles.optionsPanelSection}
            data-tour={blockIndex === 0 ? "position-field" : undefined}
          >
            <span className={styles.optionsPanelSectionTitle}>Display order</span>
            <div className={styles.optionsPanelField}>
              <label className={styles.optionsPanelLabel}>Position</label>
              <TextInput
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
      {((onExplanationChange && showOptions) ||
        (onAddAlternative && showAddAlternative && showOptions)) && (
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
                <Icon name="copy" size={14} />
                <span>Add alternative</span>
              </button>
            )}
            {onExplanationChange && showOptions && (
              <button
                className={styles.optionsPanelAction}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExplanation(!showExplanation);
                  setOptionsOpened(false);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Icon name="comment" size={14} />
                <span>{showExplanation ? "Hide explanation" : "Add explanation"}</span>
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
      data-dragging={isDragging || undefined}
      style={{
        width: `${blockWidth}%`,
        maxWidth: "800px",
        flexShrink: 0,
        ...style
      }}
    >
      {/* Main block row */}
      <div
        className={`${styles.blockRow} ${block.isDistractor ? styles.blockRowDistractor : ""}`}
        style={
          showExplanation ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : undefined
        }
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
            <Icon name="bars" />
          </div>
        )}

        {/* Block number badge */}
        {blockIndex !== undefined && isStandalone && (
          <div className={styles.blockNum}>{blockIndex + 1}</div>
        )}

        {/* Inline distractor toggle — Simple mode only */}
        {showInlineDistractor && (
          <div className={styles.inlineDistractorArea}>
            <Tooltip
              label={block.isDistractor ? "Distractor block" : "Solution block"}
              position="top"
            >
              <div
                className={`${styles.inlineDistractorPill} ${block.isDistractor ? styles.inlineDistractorPillActive : ""}`}
                data-tour={blockIndex === 0 ? "distractor-pill" : undefined}
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
            </Tooltip>
            {/* Inline paired checkbox */}
            {showInlinePaired && (
              <div className={styles.inlinePairedWrapper}>
                <Tooltip label="Pair with block above" position="top">
                  <Checkbox
                    id={`paired-inline-${block.id}`}
                    size="xs"
                    aria-label={`Pair block ${(blockIndex ?? 0) + 1} with the block above`}
                    checked={block.isDistractor === true && block.pairedWithBlockAbove === true}
                    onChange={(e) => {
                      const paired = e.currentTarget.checked;
                      if (paired && !block.isDistractor) {
                        onDistractorChange!(block.id, true);
                      }
                      onPairedChange!(block.id, paired);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </Tooltip>
              </div>
            )}
          </div>
        )}

        {/* Correct checkbox for alternatives */}
        {showCorrectCheckbox && (
          <div className={styles.correctCheckboxWrapper}>
            <Tooltip label="Correct answer" position="top">
              <Checkbox
                id={`correct-${block.id}`}
                size="xs"
                aria-label={`Block ${(blockIndex ?? 0) + 1} is a correct answer`}
                checked={block.isCorrect === true}
                onChange={(e) => handleCorrectChange(e.currentTarget.checked)}
                onMouseDown={(e) => e.stopPropagation()}
              />
            </Tooltip>
          </div>
        )}

        {/* Editor area */}
        <div className={styles.blockEditor}>{renderEditor()}</div>

        {/* Compact action bar — replaces old inlineMeta + blockActions */}
        <div className={styles.blockActions}>
          {/* Options menu trigger — Enhanced mode only */}
          {hasPopoverOptions && (
            <Popover
              opened={optionsOpened}
              onChange={setOptionsOpened}
              position="bottom-end"
              withArrow
              shadow="md"
            >
              <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  radius="xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOptionsOpened((o) => !o);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={styles.actionBtn}
                  aria-label="Block options"
                >
                  <Icon name="ellipsis-v" size={16} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown className={styles.optionsPanelOverlay} p={0}>
                {renderOptionsPanel()}
              </Popover.Dropdown>
            </Popover>
          )}
          {/* Inline alternative button — Simple mode only */}
          {showInlineAlternative && (
            <Tooltip label="Add alternative" position="top">
              <ActionIcon
                variant="subtle"
                radius="xl"
                onClick={handleAddAlternative}
                onMouseDown={(e) => e.stopPropagation()}
                className={styles.actionBtn}
                aria-label="Add alternative"
              >
                <Icon name="copy" size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {/* Inline explanation button — Simple mode only */}
          {showInlineExplanation && (
            <Tooltip
              label={showExplanation ? "Hide explanation" : "Add explanation"}
              position="top"
            >
              <ActionIcon
                variant="subtle"
                radius="xl"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExplanation(!showExplanation);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={`${styles.actionBtn} ${block.explanation ? styles.actionBtnHighlight : ""}`}
                aria-label={showExplanation ? "Hide explanation" : "Add explanation"}
              >
                <Icon name="comment" size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {/* Remove — always visible */}
          <ActionIcon
            variant="subtle"
            radius="xl"
            color="red"
            onClick={handleRemove}
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            aria-label="Remove block"
          >
            <Icon name="trash" size={16} />
          </ActionIcon>
        </div>
      </div>

      {/* Explanation row — appears below the main row when toggled */}
      {showExplanation && onExplanationChange && (
        <div
          className={styles.explanationRow}
          data-tour={blockIndex === 0 ? "explanation-row" : undefined}
        >
          <span className={styles.explanationIcon}>
            <Icon name="comment" size={14} />
          </span>
          <Textarea
            value={block.explanation || ""}
            onChange={(e) => onExplanationChange(block.id, e.target.value)}
            className={styles.explanationInput}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Block explanation (shown to students after solving)…"
            autosize
            minRows={1}
            style={{ flex: 1 }}
          />
        </div>
      )}
    </div>
  );
};
