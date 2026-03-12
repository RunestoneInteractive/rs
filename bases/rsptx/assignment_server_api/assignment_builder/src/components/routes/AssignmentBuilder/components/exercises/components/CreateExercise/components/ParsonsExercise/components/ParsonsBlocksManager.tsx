import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  DragOverlay,
  defaultDropAnimation,
  pointerWithin,
  CollisionDetection,
  MeasuringStrategy
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { Button } from "primereact/button";
import React, { FC, useState, useCallback, useRef, useMemo } from "react";

import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { BlockItem } from "./BlockItem";
import styles from "./ParsonsExercise.module.css";
import { SortableBlock } from "./SortableBlock";

const MAX_INDENT_LEVELS = 10;

const INDENT_WIDTH = 39;

const MAX_ALTERNATIVES = 3;

const SNAP_THRESHOLD = 12;

const customDropAnimation = {
  ...defaultDropAnimation,
  dragSourceOpacity: 0.5
};

const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  const { droppableRects } = args;

  const containerRect = droppableRects.get("blocks-container");

  if (!containerRect) {
    return [];
  }

  const coordinates = args.pointerCoordinates;

  if (
    coordinates &&
    coordinates.x >= containerRect.left &&
    coordinates.x <= containerRect.right &&
    coordinates.y >= containerRect.top &&
    coordinates.y <= containerRect.bottom
  ) {
    return [{ id: "blocks-container" }];
  }

  return [];
};

interface ParsonsBlocksManagerProps {
  blocks: ParsonsBlock[];
  onChange: (blocks: ParsonsBlock[]) => void;
  language: string;
  onAddBlock?: () => void;
  grader?: "line" | "dag";
  orderMode?: "random" | "custom";
  mode?: "simple" | "enhanced";
}

export const ParsonsBlocksManager: FC<ParsonsBlocksManagerProps> = ({
  blocks,
  onChange,
  language,
  onAddBlock,
  grader = "line",
  orderMode = "random",
  mode = "enhanced"
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightedGuide, setHighlightedGuide] = useState<number | null>(null);
  const [initialOffset, setInitialOffset] = useState<number>(0);
  const [draggingGroup, setDraggingGroup] = useState<ParsonsBlock[]>([]);
  const [dragWidths, setDragWidths] = useState<{ [key: string]: number }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const blocksContainerRef = useRef<HTMLDivElement>(null);

  const activeBlock = blocks.find((block) => block.id === activeId);

  const blockGroups = useMemo(() => {
    const groups: Record<string, ParsonsBlock[]> = {};

    blocks.forEach((block) => {
      if (block.groupId) {
        if (!groups[block.groupId]) {
          groups[block.groupId] = [];
        }
        groups[block.groupId].push(block);
      }
    });

    return groups;
  }, [blocks]);

  const blockHasAlternatives = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);

      if (!block || !block.groupId) return false;

      return blockGroups[block.groupId]?.length > 1;
    },
    [blocks, blockGroups]
  );

  const maxAllowedIndent = useMemo(() => {
    if (blocks.length === 0) return 0;

    const otherBlocks = activeId ? blocks.filter((block) => block.id !== activeId) : blocks;

    if (otherBlocks.length === 0) return 0;

    const currentMaxIndent = Math.max(...otherBlocks.map((block) => block.indent));

    return Math.min(MAX_INDENT_LEVELS, currentMaxIndent + 1);
  }, [blocks, activeId]);

  const availableIndents = useMemo(() => {
    if (blocks.length === 0) return [0];

    const indents = [];

    for (let i = 0; i <= maxAllowedIndent; i++) {
      indents.push(i);
    }
    return indents;
  }, [blocks, maxAllowedIndent]);

  const getBlockWidth = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);

      if (!block || !block.groupId) return 100;

      const groupCount = blocks.filter((b) => b.groupId === block.groupId).length;

      return 100 / groupCount;
    },
    [blocks]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        distance: 5
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const originalEvent = event.active.data.current?.originalEvent as
        | MouseEvent
        | TouchEvent
        | null;

      if (originalEvent) {
        const target = originalEvent.target as HTMLElement;

        if (
          target.tagName.toLowerCase() === "input" ||
          target.tagName.toLowerCase() === "button" ||
          target.closest("input") ||
          target.closest("button")
        ) {
          return;
        }
      }

      const blockId = event.active.id as string;

      setActiveId(blockId);

      const blockElement = document.querySelector(`[data-id="${blockId}"]`);

      if (blockElement) {
        const rect = blockElement.getBoundingClientRect();

        setDragWidths({ [blockId]: rect.width });
      }

      const currentBlock = blocks.find((block) => block.id === blockId);

      if (currentBlock) {
        setInitialOffset(currentBlock.indent * INDENT_WIDTH);

        if (currentBlock.groupId) {
          const groupBlocks = blocks.filter((block) => block.groupId === currentBlock.groupId);

          setDraggingGroup(groupBlocks);

          const widths: { [key: string]: number } = {};

          const groupContainer = document.querySelector(
            `[data-group-id="${currentBlock.groupId}"]`
          );

          if (groupContainer) {
            const containerWidth = groupContainer.getBoundingClientRect().width;

            widths["group-container"] = containerWidth;
          }

          groupBlocks.forEach((block) => {
            const el = document.querySelector(`[data-id="${block.id}"]`);

            if (el) {
              widths[block.id] = el.getBoundingClientRect().width;
            }
          });

          setDragWidths(widths);
        } else {
          setDraggingGroup([currentBlock]);
        }
      }
    },
    [blocks]
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!containerRef.current || !activeId) return;

      const containerRect = containerRef.current.getBoundingClientRect();

      const currentBlock = blocks.find((block) => block.id === activeId);

      if (!currentBlock) return;

      const relativeX = event.delta.x;

      const currentIndentPx = currentBlock.indent * INDENT_WIDTH;

      const newPositionPx = currentIndentPx + relativeX;

      let closestIndent = Math.round(newPositionPx / INDENT_WIDTH);

      closestIndent = Math.max(0, Math.min(maxAllowedIndent, closestIndent));

      if (availableIndents.includes(closestIndent)) {
        const distanceToClosestGuide = Math.abs(closestIndent * INDENT_WIDTH - newPositionPx);

        if (distanceToClosestGuide < SNAP_THRESHOLD) {
          setHighlightedGuide(closestIndent);
        } else {
          setHighlightedGuide(null);
        }
      } else {
        setHighlightedGuide(null);
      }
    },
    [activeId, blocks, maxAllowedIndent, availableIndents]
  );

  const calculateNewPosition = useCallback(
    (clientY: number): number => {
      if (!blocksContainerRef.current) return blocks.length;

      const containerRect = blocksContainerRef.current.getBoundingClientRect();
      const blockNodes = blocksContainerRef.current.querySelectorAll(".sortable-block");

      if (blockNodes.length > 0) {
        const firstRect = blockNodes[0].getBoundingClientRect();

        if (clientY < firstRect.top) {
          return 0;
        }
      }

      for (let i = 0; i < blockNodes.length; i++) {
        const blockRect = blockNodes[i].getBoundingClientRect();
        const nextBlockRect =
          i < blockNodes.length - 1 ? blockNodes[i + 1].getBoundingClientRect() : null;

        if (clientY >= blockRect.bottom && (!nextBlockRect || clientY < nextBlockRect.top)) {
          return i + 1;
        }
      }

      return blocks.length;
    },
    [blocks.length]
  );

  const getGroupedBlockIds = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);

      if (!block || !block.groupId) return [blockId];

      return blocks.filter((b) => b.groupId === block.groupId).map((b) => b.id);
    },
    [blocks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      let updatedBlocks = [...blocks];

      if (!activeId) {
        setHighlightedGuide(null);
        setInitialOffset(0);
        setDraggingGroup([]);
        setDragWidths({});
        return;
      }

      const groupedBlockIds = getGroupedBlockIds(activeId);

      const firstGroupBlockIndex = Math.min(
        ...groupedBlockIds.map((id) => updatedBlocks.findIndex((block) => block.id === id))
      );

      if (over) {
        if (over.id === "blocks-container") {
          const pointerY = (event.activatorEvent as MouseEvent).clientY;
          let newIndex = calculateNewPosition(pointerY);

          if (
            newIndex !== firstGroupBlockIndex &&
            newIndex !== firstGroupBlockIndex + groupedBlockIds.length
          ) {
            if (newIndex > firstGroupBlockIndex) {
              newIndex -= groupedBlockIds.length;
            }

            const blocksWithoutGroup = updatedBlocks.filter(
              (block) => !groupedBlockIds.includes(block.id)
            );

            const groupBlocks = groupedBlockIds
              .map((id) => updatedBlocks.find((block) => block.id === id))
              .filter(Boolean) as ParsonsBlock[];

            updatedBlocks = [
              ...blocksWithoutGroup.slice(0, newIndex),
              ...groupBlocks,
              ...blocksWithoutGroup.slice(newIndex)
            ];
          }
        } else if (active.id !== over.id) {
          const overId = over.id as string;
          const overBlock = blocks.find((block) => block.id === overId);

          if (overBlock && overBlock.groupId) {
            const overGroupIds = blocks
              .filter((block) => block.groupId === overBlock.groupId)
              .map((block) => block.id);

            const firstOverGroupIndex = Math.min(
              ...overGroupIds.map((id) => updatedBlocks.findIndex((block) => block.id === id))
            );

            const blocksWithoutGroup = updatedBlocks.filter(
              (block) => !groupedBlockIds.includes(block.id)
            );

            const groupBlocks = groupedBlockIds
              .map((id) => updatedBlocks.find((block) => block.id === id))
              .filter(Boolean) as ParsonsBlock[];

            updatedBlocks = [
              ...blocksWithoutGroup.slice(0, firstOverGroupIndex),
              ...groupBlocks,
              ...blocksWithoutGroup.slice(firstOverGroupIndex)
            ];
          } else {
            const newIndex = updatedBlocks.findIndex((block) => block.id === overId);

            const blocksWithoutGroup = updatedBlocks.filter(
              (block) => !groupedBlockIds.includes(block.id)
            );

            const groupBlocks = groupedBlockIds
              .map((id) => updatedBlocks.find((block) => block.id === id))
              .filter(Boolean) as ParsonsBlock[];

            updatedBlocks = [
              ...blocksWithoutGroup.slice(0, newIndex),
              ...groupBlocks,
              ...blocksWithoutGroup.slice(newIndex)
            ];
          }
        }
      }

      if (highlightedGuide !== null) {
        updatedBlocks = updatedBlocks.map((block) => {
          if (groupedBlockIds.includes(block.id)) {
            return { ...block, indent: highlightedGuide };
          }
          return block;
        });
      }

      onChange(updatedBlocks);

      setActiveId(null);
      setHighlightedGuide(null);
      setInitialOffset(0);
      setDraggingGroup([]);
      setDragWidths({});
    },
    [blocks, onChange, activeId, highlightedGuide, calculateNewPosition, getGroupedBlockIds]
  );

  const handleContentChange = useCallback(
    (id: string, content: string) => {
      const newBlocks = blocks.map((block) => {
        if (block.id === id) {
          return { ...block, content };
        }
        return block;
      });

      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  const handleAddBlock = useCallback(() => {
    if (onAddBlock) {
      onAddBlock();
    } else {
      const newBlock: ParsonsBlock = {
        id: `block-${Date.now()}`,
        content: "",
        indent: 0
      };

      onChange([...blocks, newBlock]);
    }
  }, [blocks, onChange, onAddBlock]);

  const handleRemoveBlock = useCallback(
    (id: string) => {
      const blockToRemove = blocks.find((block) => block.id === id);

      if (blockToRemove?.groupId) {
        const groupBlocks = blocks.filter((block) => block.groupId === blockToRemove.groupId);

        if (groupBlocks.length <= 2) {
          const otherBlock = groupBlocks.find((block) => block.id !== id);

          let newBlocks = blocks.filter((block) => block.id !== id);

          if (otherBlock) {
            newBlocks = newBlocks.map((block) => {
              if (block.id === otherBlock.id) {
                const { groupId, isCorrect, ...rest } = block;

                return rest;
              }
              return block;
            });
          }

          onChange(newBlocks);
          return;
        } else {
          let newBlocks = blocks.filter((block) => block.id !== id);

          if (blockToRemove.isCorrect) {
            const remainingGroupBlocks = newBlocks.filter(
              (block) => block.groupId === blockToRemove.groupId
            );

            if (
              remainingGroupBlocks.length > 0 &&
              !remainingGroupBlocks.some((block) => block.isCorrect)
            ) {
              const updatedBlocks = newBlocks.map((block) => {
                if (block.id === remainingGroupBlocks[0].id) {
                  return { ...block, isCorrect: true };
                }
                return block;
              });

              onChange(updatedBlocks);
              return;
            }
          }

          onChange(newBlocks);
          return;
        }
      } else {
        const newBlocks = blocks.filter((block) => block.id !== id);

        onChange(newBlocks);
      }
    },
    [blocks, onChange]
  );

  const handleAddAlternative = useCallback(
    (id: string) => {
      const originalBlock = blocks.find((block) => block.id === id);

      if (!originalBlock) return;

      let groupId = originalBlock.groupId;

      if (!groupId) {
        groupId = `group-${Date.now()}`;
      }

      const groupBlocks = blocks.filter((block) => block.groupId === groupId);

      if (groupBlocks.length >= MAX_ALTERNATIVES) {
        return;
      }

      const newBlock: ParsonsBlock = {
        id: `block-${Date.now()}`,
        content: originalBlock.content,
        indent: originalBlock.indent,
        groupId,
        isCorrect: false
      };

      const updatedBlocks = blocks.map((block) => {
        if (block.id === originalBlock.id) {
          const updatedBlock = {
            ...block,
            groupId,
            isCorrect: block.isCorrect === undefined ? true : block.isCorrect
          };

          return updatedBlock;
        }
        return block;
      });

      const blockIndex = updatedBlocks.findIndex((block) => block.id === id);

      const lastGroupBlockIndex = Math.max(
        ...groupBlocks.map((block) => updatedBlocks.findIndex((b) => b.id === block.id))
      );

      const insertIndex = Math.max(blockIndex, lastGroupBlockIndex) + 1;

      const finalBlocks = [
        ...updatedBlocks.slice(0, insertIndex),
        newBlock,
        ...updatedBlocks.slice(insertIndex)
      ];

      onChange(finalBlocks);
    },
    [blocks, onChange]
  );

  const handleCorrectChange = useCallback(
    (id: string, isCorrect: boolean) => {
      if (!isCorrect) return;

      const block = blocks.find((block) => block.id === id);

      if (!block || !block.groupId) return;

      let newBlocks = blocks.map((b) => {
        if (b.groupId === block.groupId) {
          return { ...b, isCorrect: b.id === id };
        }
        return b;
      });

      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  const handleSplitBlock = useCallback(
    (id: string, lineIndex: number) => {
      const blockToSplit = blocks.find((block) => block.id === id);

      if (!blockToSplit) return;

      if (blockToSplit.groupId) {
        const groupBlocks = blocks.filter((block) => block.groupId === blockToSplit.groupId);

        if (groupBlocks.length > 1) return;
      }

      const lines = blockToSplit.content.split("\n");

      if (lines.length <= 1 || lineIndex <= 0 || lineIndex >= lines.length) return;

      const topContent = lines.slice(0, lineIndex).join("\n");
      const bottomContent = lines.slice(lineIndex).join("\n");

      const updatedBlocks = blocks.map((block) => {
        if (block.id === id) {
          return { ...block, content: topContent };
        }
        return block;
      });

      const newBlock: ParsonsBlock = {
        id: `block-${Date.now()}`,
        content: bottomContent,
        indent: blockToSplit.indent,
        groupId: blockToSplit.groupId,
        isCorrect: false
      };

      const blockIndex = blocks.findIndex((block) => block.id === id);

      const finalBlocks = [
        ...updatedBlocks.slice(0, blockIndex + 1),
        newBlock,
        ...updatedBlocks.slice(blockIndex + 1)
      ];

      onChange(finalBlocks);
    },
    [blocks, onChange]
  );

  const handleDistractorChange = useCallback(
    (id: string, isDistractor: boolean) => {
      const newBlocks = blocks.map((block) => {
        if (block.id === id) {
          return {
            ...block,
            isDistractor,
            pairedWithBlockAbove: isDistractor ? block.pairedWithBlockAbove : false
          };
        }
        return block;
      });
      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  const handlePairedChange = useCallback(
    (id: string, paired: boolean) => {
      const newBlocks = blocks.map((block) => {
        if (block.id === id) {
          return { ...block, pairedWithBlockAbove: paired };
        }
        return block;
      });
      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  const handleExplanationChange = useCallback(
    (id: string, explanation: string) => {
      const newBlocks = blocks.map((block) => {
        if (block.id === id) {
          return { ...block, explanation };
        }
        return block;
      });
      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  const handleTagChange = useCallback(
    (id: string, tag: string) => {
      const newBlocks = blocks.map((block) => {
        if (block.id === id) {
          return { ...block, tag };
        }
        return block;
      });
      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  const handleDependsChange = useCallback(
    (id: string, depends: string[]) => {
      const newBlocks = blocks.map((block) => {
        if (block.id === id) {
          return { ...block, depends };
        }
        return block;
      });
      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  const handleOrderChange = useCallback(
    (id: string, order: number) => {
      const newBlocks = blocks.map((block) => {
        if (block.id === id) {
          return { ...block, displayOrder: order };
        }
        return block;
      });
      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  const allTags = useMemo(() => {
    return blocks.filter((b) => b.tag && !b.isDistractor).map((b) => b.tag as string);
  }, [blocks]);

  const blockIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    let idx = 0;
    const processedGroups = new Set<string>();
    blocks.forEach((block) => {
      if (block.groupId) {
        if (!processedGroups.has(block.groupId)) {
          processedGroups.add(block.groupId);
          const groupBlocks = blocks.filter((b) => b.groupId === block.groupId);
          groupBlocks.forEach((b) => {
            map[b.id] = idx;
          });
          idx++;
        }
      } else {
        map[block.id] = idx;
        idx++;
      }
    });
    return map;
  }, [blocks]);

  const renderIndentationGuides = () => {
    return availableIndents.map((i) => {
      const isHighlighted = highlightedGuide === i;

      return (
        <div
          key={`indent-${i}`}
          className={`${styles.indentGuide} ${isHighlighted ? styles.indentGuideHighlighted : ""}`}
          style={{
            left: `${i * INDENT_WIDTH}px`
          }}
        />
      );
    });
  };

  const organizedBlocks = useMemo(() => {
    const result: ParsonsBlock[][] = [];
    const processedIds = new Set<string>();

    blocks.forEach((block) => {
      if (processedIds.has(block.id)) return;

      if (block.groupId) {
        const groupBlocks = blocks.filter((b) => b.groupId === block.groupId);

        result.push(groupBlocks);
        groupBlocks.forEach((b) => processedIds.add(b.id));
      } else {
        result.push([block]);
        processedIds.add(block.id);
      }
    });

    return result;
  }, [blocks]);

  const shouldShowDragHandle = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);

      if (!block || !block.groupId) return true;

      const groupBlocks = blocks.filter((b) => b.groupId === block.groupId);

      const sortedGroupBlocks = groupBlocks.sort(
        (a, b) =>
          blocks.findIndex((blk) => blk.id === a.id) - blocks.findIndex((blk) => blk.id === b.id)
      );

      return sortedGroupBlocks[0]?.id === blockId;
    },
    [blocks]
  );

  // Count stats for the header
  const solutionCount = blocks.filter((b) => !b.isDistractor).length;
  const distractorCount = blocks.filter((b) => b.isDistractor).length;
  const groupCount = Object.keys(blockGroups).length;

  return (
    <div className={styles.managerContainer} data-tour="blocks-manager">
      {/* Stats bar */}
      {blocks.length > 0 && (
        <div className={styles.statsBar} data-tour="stats-bar">
          <div className={styles.statItem}>
            <span className={styles.statCount}>{blocks.length}</span>
            <span className={styles.statLabel}>blocks</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={`${styles.statDot} ${styles.statDotSolution}`} />
            <span className={styles.statCount}>{solutionCount}</span>
            <span className={styles.statLabel}>solution</span>
          </div>
          {distractorCount > 0 && (
            <>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={`${styles.statDot} ${styles.statDotDistractor}`} />
                <span className={styles.statCount}>{distractorCount}</span>
                <span className={styles.statLabel}>distractor</span>
              </div>
            </>
          )}
          {groupCount > 0 && (
            <>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={`${styles.statDot} ${styles.statDotGroup}`} />
                <span className={styles.statCount}>{groupCount}</span>
                <span className={styles.statLabel}>groups</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Blocks workspace */}
      <div className={styles.workspace}>
        <div ref={containerRef} className={styles.blocksOuter} data-tour="blocks-workspace">
          {/* Indentation guides */}
          <div className={styles.indentGuidesContainer}>{renderIndentationGuides()}</div>

          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            measuring={{
              droppable: {
                strategy: MeasuringStrategy.Always
              }
            }}
          >
            <div ref={blocksContainerRef} className={styles.blocksInner} id="blocks-container">
              <SortableContext
                items={blocks.map((block) => block.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-column gap-1 relative z-1">
                  {organizedBlocks.map((blockGroup, groupIndex) => {
                    if (blockGroup.length === 1) {
                      const block = blockGroup[0];

                      return (
                        <SortableBlock
                          key={block.id}
                          id={block.id}
                          block={block}
                          language={language}
                          indentWidth={INDENT_WIDTH}
                          maxIndent={maxAllowedIndent}
                          blockWidth={100}
                          blockIndex={blockIndexMap[block.id]}
                          onContentChange={handleContentChange}
                          onRemove={handleRemoveBlock}
                          onAddAlternative={handleAddAlternative}
                          onSplitBlock={handleSplitBlock}
                          onDistractorChange={handleDistractorChange}
                          onPairedChange={handlePairedChange}
                          onExplanationChange={handleExplanationChange}
                          onTagChange={handleTagChange}
                          onDependsChange={handleDependsChange}
                          onOrderChange={handleOrderChange}
                          showAddAlternative={true}
                          showDragHandle={true}
                          grader={grader}
                          orderMode={orderMode}
                          allTags={allTags}
                          mode={mode}
                          data-tour={groupIndex === 0 ? "first-block" : undefined}
                        />
                      );
                    }

                    const indentWidth = blockGroup[0].indent * INDENT_WIDTH;
                    const blockWidth = 100 / blockGroup.length;

                    const sortedBlocks = [...blockGroup].sort(
                      (a, b) =>
                        blocks.findIndex((blk) => blk.id === a.id) -
                        blocks.findIndex((blk) => blk.id === b.id)
                    );

                    return (
                      <div
                        key={`group-${groupIndex}`}
                        className="flex flex-row w-full align-items-start"
                        style={{
                          marginLeft: `${indentWidth}px`,
                          width: "85%",
                          minWidth: "max-content"
                        }}
                        data-group-id={blockGroup[0].groupId || ""}
                      >
                        {blockGroup.map((block) => {
                          const isFirstInGroup = sortedBlocks[0]?.id === block.id;

                          return (
                            <SortableBlock
                              key={block.id}
                              id={block.id}
                              block={block}
                              language={language}
                              indentWidth={INDENT_WIDTH}
                              maxIndent={maxAllowedIndent}
                              blockWidth={blockWidth}
                              blockIndex={blockIndexMap[block.id]}
                              onContentChange={handleContentChange}
                              onRemove={handleRemoveBlock}
                              onAddAlternative={handleAddAlternative}
                              onCorrectChange={handleCorrectChange}
                              onSplitBlock={handleSplitBlock}
                              onDistractorChange={isFirstInGroup ? handleDistractorChange : undefined}
                              onPairedChange={isFirstInGroup ? handlePairedChange : undefined}
                              onExplanationChange={isFirstInGroup ? handleExplanationChange : undefined}
                              onTagChange={isFirstInGroup ? handleTagChange : undefined}
                              onDependsChange={isFirstInGroup ? handleDependsChange : undefined}
                              onOrderChange={isFirstInGroup ? handleOrderChange : undefined}
                              hasAlternatives={true}
                              showAddAlternative={blockGroup.length < MAX_ALTERNATIVES}
                              showDragHandle={isFirstInGroup}
                              isFirstInLine={isFirstInGroup}
                              grader={grader}
                              orderMode={orderMode}
                              allTags={allTags}
                              mode={mode}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
            </div>

            <DragOverlay dropAnimation={customDropAnimation}>
              {activeId && draggingGroup.length > 0 ? (
                <div
                  style={{
                    marginLeft: `${initialOffset}px`,
                    display: "flex",
                    flexDirection: draggingGroup.length > 1 ? "row" : "column",
                    width:
                      draggingGroup.length > 1 && dragWidths["group-container"]
                        ? `${dragWidths["group-container"]}px`
                        : draggingGroup.length > 1
                          ? "85%"
                          : "max-content",
                    minWidth: draggingGroup.length > 1 ? "min-content" : undefined,
                    boxSizing: "border-box"
                  }}
                  className="drag-overlay-container gap-1"
                >
                  {draggingGroup.length === 1 ? (
                    <BlockItem
                      block={draggingGroup[0]}
                      language={language}
                      indentWidth={INDENT_WIDTH}
                      maxIndent={maxAllowedIndent}
                      blockWidth={100}
                      onContentChange={() => {}}
                      onRemove={() => {}}
                      showDragHandle={true}
                      grader={grader}
                      orderMode={orderMode}
                      dragHandleProps={{}}
                      style={{
                        width: dragWidths[draggingGroup[0].id]
                          ? `${dragWidths[draggingGroup[0].id]}px`
                          : "100%",
                        minWidth: "300px"
                      }}
                    />
                  ) : (
                    draggingGroup.map((block, index) => {
                      const blockWidth = 100 / draggingGroup.length;
                      const storedWidth = dragWidths[block.id];

                      return (
                        <BlockItem
                          key={block.id}
                          block={block}
                          language={language}
                          indentWidth={INDENT_WIDTH}
                          maxIndent={maxAllowedIndent}
                          blockWidth={blockWidth}
                          onContentChange={() => {}}
                          onRemove={() => {}}
                          hasAlternatives={true}
                          dragHandleProps={{}}
                          showDragHandle={index === 0}
                          style={{
                            width: storedWidth ? `${storedWidth}px` : `${blockWidth}%`,
                            minWidth: "200px",
                            flexShrink: 0,
                            flexGrow: 0
                          }}
                        />
                      );
                    })
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Empty state */}
          {blocks.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <i className="pi pi-code" />
              </div>
              <p className={styles.emptyStateTitle}>No code blocks yet</p>
              <p className={styles.emptyStateDesc}>
                Click <strong>"Add Block"</strong> in the toolbar above to create your first code
                block.
              </p>
              <Button
                label="Add Your First Block"
                icon="pi pi-plus"
                className={styles.emptyStateBtn}
                onClick={handleAddBlock}
                severity="info"
                outlined
                size="small"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
