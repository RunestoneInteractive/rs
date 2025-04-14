import styles from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/components/MultiChoiceExercise/MultiChoiceOptions.module.css";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragMoveEvent,
  DragOverlay,
  defaultDropAnimation,
  pointerWithin,
  getFirstCollision,
  rectIntersection,
  CollisionDetection,
  UniqueIdentifier,
  MeasuringStrategy,
  Modifier,
  DroppableContainer
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { Button } from "primereact/button";
import React, { FC, useState, useCallback, useRef, useMemo } from "react";

import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { BlockItem } from "./BlockItem";
import { SortableBlock } from "./SortableBlock";

// Number of indentation levels to display
const MAX_INDENT_LEVELS = 10;
// Width in pixels of each indentation level
const INDENT_WIDTH = 39;
// Maximum number of alternative blocks allowed in a group
const MAX_ALTERNATIVES = 3;
// Block width in percentage when no alternatives
const BLOCK_WIDTH = 30;
// Block width in percentage when alternatives exist
const ALTERNATIVE_BLOCK_WIDTH = 30;
// Snap threshold in pixels
const SNAP_THRESHOLD = 12;

// Custom drop animation options
const customDropAnimation = {
  ...defaultDropAnimation,
  dragSourceOpacity: 0.5
};

// Custom collision detection strategy
const customCollisionDetection: CollisionDetection = (args) => {
  // First, detect any direct collisions with other blocks
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  // If no direct collisions, use the container itself as the collision target
  // This allows dropping anywhere in the container
  const { droppableContainers, droppableRects } = args;

  // Find the container that matches our blocks container
  const containerRect = droppableRects.get("blocks-container");

  if (!containerRect) {
    return [];
  }

  // Check if the pointer is within the container
  const coordinates = args.pointerCoordinates;

  if (
    coordinates &&
    coordinates.x >= containerRect.left &&
    coordinates.x <= containerRect.right &&
    coordinates.y >= containerRect.top &&
    coordinates.y <= containerRect.bottom
  ) {
    // Return the container as the collision target
    return [{ id: "blocks-container" }];
  }

  return [];
};

interface ParsonsBlocksManagerProps {
  blocks: ParsonsBlock[];
  onChange: (blocks: ParsonsBlock[]) => void;
  language: string;
}

export const ParsonsBlocksManager: FC<ParsonsBlocksManagerProps> = ({
  blocks,
  onChange,
  language
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightedGuide, setHighlightedGuide] = useState<number | null>(null);
  const [initialOffset, setInitialOffset] = useState<number>(0);
  const [draggingGroup, setDraggingGroup] = useState<ParsonsBlock[]>([]);
  const [dragWidths, setDragWidths] = useState<{ [key: string]: number }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const blocksContainerRef = useRef<HTMLDivElement>(null);

  // Find the active block
  const activeBlock = blocks.find((block) => block.id === activeId);

  // Group blocks by groupId
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

  // Check if a block has alternatives
  const blockHasAlternatives = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);

      if (!block || !block.groupId) return false;

      return blockGroups[block.groupId]?.length > 1;
    },
    [blocks, blockGroups]
  );

  // Calculate the maximum allowed indentation level
  // Only allow indentation one level greater than the current maximum
  // IMPORTANT: We exclude the active block from this calculation to prevent
  // the user from continually increasing the indentation of a single block
  const maxAllowedIndent = useMemo(() => {
    if (blocks.length === 0) return 0;

    // Filter out the active block to calculate the max based on other blocks
    const otherBlocks = activeId ? blocks.filter((block) => block.id !== activeId) : blocks;

    // If there are no other blocks, only allow indent level 0
    if (otherBlocks.length === 0) return 0;

    const currentMaxIndent = Math.max(...otherBlocks.map((block) => block.indent));

    return Math.min(MAX_INDENT_LEVELS, currentMaxIndent + 1);
  }, [blocks, activeId]);

  // Calculate the available indentation guides
  const availableIndents = useMemo(() => {
    if (blocks.length === 0) return [0];

    const indents = [];

    for (let i = 0; i <= maxAllowedIndent; i++) {
      indents.push(i);
    }
    return indents;
  }, [blocks, maxAllowedIndent]);

  // Calculate the block width based on number of alternatives in the group
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
      // Adding activation constraints to prevent accidental drags when typing
      activationConstraint: {
        // Delay drag activation to allow for clicking inputs
        delay: 250,
        // Require a minimum distance before considering it a drag
        distance: 5
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      // Get the original DOM event
      const originalEvent = event.active.data.current?.originalEvent as
        | MouseEvent
        | TouchEvent
        | null;

      if (originalEvent) {
        // Check if the target is an input or button
        const target = originalEvent.target as HTMLElement;

        if (
          target.tagName.toLowerCase() === "input" ||
          target.tagName.toLowerCase() === "button" ||
          target.closest("input") ||
          target.closest("button")
        ) {
          // Don't initiate drag operation
          return;
        }
      }

      const blockId = event.active.id as string;

      setActiveId(blockId);

      // Capture current element dimensions for accurate drag overlay
      const blockElement = document.querySelector(`[data-id="${blockId}"]`);

      if (blockElement) {
        const rect = blockElement.getBoundingClientRect();

        setDragWidths({ [blockId]: rect.width });
      }

      // Save the current indentation to position the drag overlay correctly
      const currentBlock = blocks.find((block) => block.id === blockId);

      if (currentBlock) {
        setInitialOffset(currentBlock.indent * INDENT_WIDTH);

        // If the block is part of a group, save all blocks in the group for drag overlay
        if (currentBlock.groupId) {
          const groupBlocks = blocks.filter((block) => block.groupId === currentBlock.groupId);

          setDraggingGroup(groupBlocks);

          // Capture dimensions of all group blocks
          const widths: { [key: string]: number } = {};

          // Try to get the group container first
          const groupContainer = document.querySelector(
            `[data-group-id="${currentBlock.groupId}"]`
          );

          if (groupContainer) {
            const containerWidth = groupContainer.getBoundingClientRect().width;
            // Store a special key for the group container width

            widths["group-container"] = containerWidth;
          }

          // Then get individual block widths
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

      // Get container's bounding rect
      const containerRect = containerRef.current.getBoundingClientRect();

      // Get the current block
      const currentBlock = blocks.find((block) => block.id === activeId);

      if (!currentBlock) return;

      // Calculate the horizontal position relative to the container
      const relativeX = event.delta.x;

      // Current indentation in pixels
      const currentIndentPx = currentBlock.indent * INDENT_WIDTH;

      // New potential X position in pixels - allow negative values to reduce indentation
      const newPositionPx = currentIndentPx + relativeX;

      // Calculate the closest indent level, limited to available indents
      let closestIndent = Math.round(newPositionPx / INDENT_WIDTH);

      // Ensure the indent is within the available range, but don't restrict to minimum of 0
      // This allows dragging left to reduce indentation
      closestIndent = Math.max(0, Math.min(maxAllowedIndent, closestIndent));

      // Only allow snapping to valid indent levels
      if (availableIndents.includes(closestIndent)) {
        // Highlight the guide if we're within snapping threshold
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

  // Calculate the new position of a block based on pointer position
  const calculateNewPosition = useCallback(
    (clientY: number): number => {
      if (!blocksContainerRef.current) return blocks.length;

      const containerRect = blocksContainerRef.current.getBoundingClientRect();
      const blockNodes = blocksContainerRef.current.querySelectorAll(".sortable-block");

      // If we're above the first block, insert at the beginning
      if (blockNodes.length > 0) {
        const firstRect = blockNodes[0].getBoundingClientRect();

        if (clientY < firstRect.top) {
          return 0;
        }
      }

      // Check each block to see if we're below it
      for (let i = 0; i < blockNodes.length; i++) {
        const blockRect = blockNodes[i].getBoundingClientRect();
        const nextBlockRect =
          i < blockNodes.length - 1 ? blockNodes[i + 1].getBoundingClientRect() : null;

        // If we're between this block and the next, insert after this one
        if (clientY >= blockRect.bottom && (!nextBlockRect || clientY < nextBlockRect.top)) {
          return i + 1;
        }
      }

      // If we're below all blocks, add to the end
      return blocks.length;
    },
    [blocks.length]
  );

  // Find all blocks that should be moved together with the dragged block
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

      // Get the current block and its group IDs
      const groupedBlockIds = getGroupedBlockIds(activeId);

      // Get the index of the first block in the group
      const firstGroupBlockIndex = Math.min(
        ...groupedBlockIds.map((id) => updatedBlocks.findIndex((block) => block.id === id))
      );

      // Handle vertical reordering
      if (over) {
        if (over.id === "blocks-container") {
          // The block was dropped somewhere in the container but not over another block
          // Calculate the position based on the pointer coordinates
          const pointerY = (event.activatorEvent as MouseEvent).clientY;
          let newIndex = calculateNewPosition(pointerY);

          // Only move if the position has changed
          if (
            newIndex !== firstGroupBlockIndex &&
            newIndex !== firstGroupBlockIndex + groupedBlockIds.length
          ) {
            // When moving multiple blocks, we need to adjust the target index
            // If we're moving blocks downwards, the target index needs to be adjusted
            // to account for the blocks being removed first
            if (newIndex > firstGroupBlockIndex) {
              newIndex -= groupedBlockIds.length;
            }

            // Create a copy without the grouped blocks
            const blocksWithoutGroup = updatedBlocks.filter(
              (block) => !groupedBlockIds.includes(block.id)
            );

            // Get the group blocks in their original order
            const groupBlocks = groupedBlockIds
              .map((id) => updatedBlocks.find((block) => block.id === id))
              .filter(Boolean) as ParsonsBlock[];

            // Insert the group blocks at the new position
            updatedBlocks = [
              ...blocksWithoutGroup.slice(0, newIndex),
              ...groupBlocks,
              ...blocksWithoutGroup.slice(newIndex)
            ];
          }
        } else if (active.id !== over.id) {
          // Standard block-to-block collision
          // We need to find if the target block is part of a group
          const overId = over.id as string;
          const overBlock = blocks.find((block) => block.id === overId);

          if (overBlock && overBlock.groupId) {
            // Target is part of a group, find the first block in that group
            const overGroupIds = blocks
              .filter((block) => block.groupId === overBlock.groupId)
              .map((block) => block.id);

            const firstOverGroupIndex = Math.min(
              ...overGroupIds.map((id) => updatedBlocks.findIndex((block) => block.id === id))
            );

            // Move to before the first block in the target group
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
            // Target is a regular block, find its index
            const newIndex = updatedBlocks.findIndex((block) => block.id === overId);

            // Create a copy without the grouped blocks
            const blocksWithoutGroup = updatedBlocks.filter(
              (block) => !groupedBlockIds.includes(block.id)
            );

            // Get the group blocks in their original order
            const groupBlocks = groupedBlockIds
              .map((id) => updatedBlocks.find((block) => block.id === id))
              .filter(Boolean) as ParsonsBlock[];

            // Insert at the position of the target block
            updatedBlocks = [
              ...blocksWithoutGroup.slice(0, newIndex),
              ...groupBlocks,
              ...blocksWithoutGroup.slice(newIndex)
            ];
          }
        }
      }

      // Handle horizontal movement (indentation change)
      if (highlightedGuide !== null) {
        // Update indentation for all blocks in the group
        updatedBlocks = updatedBlocks.map((block) => {
          if (groupedBlockIds.includes(block.id)) {
            return { ...block, indent: highlightedGuide };
          }
          return block;
        });
      }

      // Apply all changes
      onChange(updatedBlocks);

      // Reset drag states
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
    const newBlock: ParsonsBlock = {
      id: `block-${Date.now()}`,
      content: "",
      indent: 0
    };

    onChange([...blocks, newBlock]);
  }, [blocks, onChange]);

  const handleRemoveBlock = useCallback(
    (id: string) => {
      // Get the block to remove
      const blockToRemove = blocks.find((block) => block.id === id);

      // If it's part of a group, handle differently
      if (blockToRemove?.groupId) {
        const groupBlocks = blocks.filter((block) => block.groupId === blockToRemove.groupId);

        // If this is the last block in a group, remove group related properties
        if (groupBlocks.length <= 2) {
          // Get the other block in the group (if any)
          const otherBlock = groupBlocks.find((block) => block.id !== id);

          // Remove the block to be deleted
          let newBlocks = blocks.filter((block) => block.id !== id);

          // If there's another block, remove its group properties
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
          // Just remove this block from the group
          let newBlocks = blocks.filter((block) => block.id !== id);

          // If the removed block was the correct one, make another one correct
          if (blockToRemove.isCorrect) {
            const remainingGroupBlocks = newBlocks.filter(
              (block) => block.groupId === blockToRemove.groupId
            );

            if (
              remainingGroupBlocks.length > 0 &&
              !remainingGroupBlocks.some((block) => block.isCorrect)
            ) {
              // Make the first remaining block correct
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
        // Standard removal for non-grouped blocks
        const newBlocks = blocks.filter((block) => block.id !== id);

        onChange(newBlocks);
      }
    },
    [blocks, onChange]
  );

  const handleAddAlternative = useCallback(
    (id: string) => {
      // Find the block to add an alternative to
      const originalBlock = blocks.find((block) => block.id === id);

      if (!originalBlock) return;

      // Create a group ID if this block doesn't have one
      let groupId = originalBlock.groupId;

      if (!groupId) {
        groupId = `group-${Date.now()}`;
      }

      // Check if we've reached the maximum number of alternatives
      const groupBlocks = blocks.filter((block) => block.groupId === groupId);

      if (groupBlocks.length >= MAX_ALTERNATIVES) {
        return; // Don't add more alternatives if we've reached the limit
      }

      // Create a new block as an alternative with the same content
      const newBlock: ParsonsBlock = {
        id: `block-${Date.now()}`,
        content: originalBlock.content,
        indent: originalBlock.indent,
        groupId,
        isCorrect: false
      };

      // If this is the first alternative for the block, make sure the original
      // block has the group ID and is marked as correct (if no block in the group is correct)
      const updatedBlocks = blocks.map((block) => {
        if (block.id === originalBlock.id) {
          // Update the original block
          const updatedBlock = {
            ...block,
            groupId,
            isCorrect: block.isCorrect === undefined ? true : block.isCorrect
          };

          return updatedBlock;
        }
        return block;
      });

      // Find the index of the original block
      const blockIndex = updatedBlocks.findIndex((block) => block.id === id);

      // Insert the new block after the original block or after the last block in the group
      const lastGroupBlockIndex = Math.max(
        ...groupBlocks.map((block) => updatedBlocks.findIndex((b) => b.id === block.id))
      );

      const insertIndex = Math.max(blockIndex, lastGroupBlockIndex) + 1;

      // Create the final blocks array with the new block inserted
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
      if (!isCorrect) return; // We don't allow unchecking a correct block

      // Find the block being marked as correct
      const block = blocks.find((block) => block.id === id);

      if (!block || !block.groupId) return;

      // Update all blocks in the group - only one can be correct
      let newBlocks = blocks.map((b) => {
        if (b.groupId === block.groupId) {
          // This block is in the same group, so set isCorrect accordingly
          return { ...b, isCorrect: b.id === id };
        }
        return b;
      });

      onChange(newBlocks);
    },
    [blocks, onChange]
  );

  // Create indentation level guides
  const renderIndentationGuides = () => {
    return availableIndents.map((i) => {
      const isHighlighted = highlightedGuide === i;

      return (
        <div
          key={`indent-${i}`}
          className={`indent-guide ${isHighlighted ? "highlighted" : ""}`}
          style={{
            position: "absolute",
            left: `${i * INDENT_WIDTH}px`,
            top: 0,
            bottom: 0,
            width: isHighlighted ? "2px" : "1px",
            backgroundColor: isHighlighted ? "var(--primary-color)" : "var(--surface-300)",
            zIndex: isHighlighted ? 2 : 0,
            transition: "background-color 0.2s, width 0.2s",
            height: "100%", // Ensure the guide spans the full height
            pointerEvents: "none" // Allow clicking through the guide
          }}
        />
      );
    });
  };

  // Organize blocks into groups for rendering
  const organizedBlocks = useMemo(() => {
    // This will hold all blocks, with group blocks organized together
    const result: ParsonsBlock[][] = [];

    // Keep track of blocks we've already processed
    const processedIds = new Set<string>();

    // Process each block in order
    blocks.forEach((block) => {
      // Skip if we've already processed this block
      if (processedIds.has(block.id)) return;

      // If block is part of a group, add all blocks in the group together
      if (block.groupId) {
        const groupBlocks = blocks.filter((b) => b.groupId === block.groupId);

        result.push(groupBlocks);
        groupBlocks.forEach((b) => processedIds.add(b.id));
      } else {
        // Single block, add it as its own group of one
        result.push([block]);
        processedIds.add(block.id);
      }
    });

    return result;
  }, [blocks]);

  // Container style with border and responsive design
  const containerStyle = {
    minHeight: "300px",
    position: "relative" as const,
    padding: 0, // Remove all padding to align blocks with guides
    overflow: "auto",
    border: "1px solid var(--surface-300)",
    borderRadius: "4px",
    background: "var(--surface-50)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
  };

  // Calculate if a block should show drag handle based on its position in the group
  const shouldShowDragHandle = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);

      if (!block || !block.groupId) return true;

      // Get all blocks in this group
      const groupBlocks = blocks.filter((b) => b.groupId === block.groupId);

      // Sort by their position in the array
      const sortedGroupBlocks = groupBlocks.sort(
        (a, b) =>
          blocks.findIndex((blk) => blk.id === a.id) - blocks.findIndex((blk) => blk.id === b.id)
      );

      // Only show handle for the first block in the group
      return sortedGroupBlocks[0]?.id === blockId;
    },
    [blocks]
  );

  return (
    <div className="flex flex-column gap-3" style={{ margin: "-2rem" }}>
      <div className={styles.optionsHeader}>
        <div className="flex justify-content-end w-full">
          <Button
            label="Add Block"
            icon="pi pi-plus"
            className={styles.addButton}
            onClick={handleAddBlock}
            aria-label="Add new block"
          />
        </div>
      </div>

      <div className="parsons-workspace w-full position-relative">
        {/* The container with indentation guides */}
        <div
          ref={containerRef}
          className="parsons-blocks-container relative w-full"
          style={{
            ...containerStyle,
            overflowX: "auto" // Allow horizontal scrolling for indented blocks
          }}
        >
          {/* Render vertical indentation guides */}
          <div
            className="indentation-guides-container"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: "100%",
              zIndex: 1,
              pointerEvents: "none"
            }}
          >
            {renderIndentationGuides()}
          </div>

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
            {/* Make the container itself droppable */}
            <div
              ref={blocksContainerRef}
              className="blocks-container"
              style={{
                minHeight: "250px",
                position: "relative",
                zIndex: 2,
                minWidth: "max-content", // Prevent content squeezing
                width: "100%"
              }}
              id="blocks-container"
            >
              <SortableContext
                items={blocks.map((block) => block.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-column gap-1 relative z-1">
                  {organizedBlocks.map((blockGroup, groupIndex) => {
                    // If this is a single block
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
                          onContentChange={handleContentChange}
                          onRemove={handleRemoveBlock}
                          onAddAlternative={handleAddAlternative}
                          showAddAlternative={true}
                          showDragHandle={true}
                        />
                      );
                    }

                    // Calculate available width after indentation
                    const indentWidth = blockGroup[0].indent * INDENT_WIDTH;
                    const blockWidth = 100 / blockGroup.length;

                    // Get the first block in the group for drag handle
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
                          width: "85%", // Always use 85% width for alternatives to prevent overflow
                          minWidth: "max-content" // Ensure group doesn't shrink below content size
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
                              onContentChange={handleContentChange}
                              onRemove={handleRemoveBlock}
                              onAddAlternative={handleAddAlternative}
                              onCorrectChange={handleCorrectChange}
                              hasAlternatives={true}
                              showAddAlternative={blockGroup.length < MAX_ALTERNATIVES}
                              showDragHandle={isFirstInGroup}
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
                    // Single block overlay
                    <BlockItem
                      block={draggingGroup[0]}
                      language={language}
                      indentWidth={INDENT_WIDTH}
                      maxIndent={maxAllowedIndent}
                      blockWidth={100}
                      onContentChange={() => {}}
                      onRemove={() => {}}
                      showDragHandle={true}
                      dragHandleProps={{}}
                      style={{
                        width: dragWidths[draggingGroup[0].id]
                          ? `${dragWidths[draggingGroup[0].id]}px`
                          : "100%",
                        minWidth: "300px"
                      }}
                    />
                  ) : (
                    // Group blocks overlay
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

          {blocks.length === 0 && (
            <div className="flex align-items-center justify-content-center h-full text-500 absolute top-0 left-0 right-0 bottom-0">
              <p>No code blocks yet. Click "Add Block" to create your first code block.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
