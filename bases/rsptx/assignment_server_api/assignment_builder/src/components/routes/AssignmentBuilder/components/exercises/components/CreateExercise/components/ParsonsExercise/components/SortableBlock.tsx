import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React, { FC, useRef } from "react";

import { ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { BlockItem } from "./BlockItem";

interface SortableBlockProps {
  id: string;
  block: ParsonsBlock;
  language: string;
  indentWidth: number;
  maxIndent: number;
  blockWidth: number;
  onContentChange: (id: string, content: string) => void;
  onRemove: (id: string) => void;
  onAddAlternative?: (id: string) => void;
  onCorrectChange?: (id: string, isCorrect: boolean) => void;
  hasAlternatives?: boolean;
  showAddAlternative?: boolean;
  showDragHandle?: boolean;
}

export const SortableBlock: FC<SortableBlockProps> = ({
  id,
  block,
  language,
  indentWidth,
  maxIndent,
  blockWidth,
  onContentChange,
  onRemove,
  onAddAlternative,
  onCorrectChange,
  hasAlternatives,
  showAddAlternative = true,
  showDragHandle = true
}) => {
  const handleRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    // Add data to help with event handling during drag start
    data: {
      // We'll check this value in the ParsonsBlocksManager
      type: "parsons-block",
      block,
      groupId: block.groupId
    },
    // Only allow dragging from the handle
    attributes: {
      // Don't apply listeners to the entire node, only to the handle
      role: "button",
      tabIndex: 0
    }
  });

  // Calculate transform with proper offset
  const style = {
    // Only apply margin when not dragging
    marginLeft: !isDragging && !hasAlternatives ? `${block.indent * indentWidth}px` : 0,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : 0,
    flex: hasAlternatives ? `0 0 ${blockWidth}%` : 1, // Use flex basis for alternatives
    width: `${blockWidth}%`,
    minWidth: hasAlternatives ? "200px" : undefined,
    maxWidth: hasAlternatives ? undefined : "800px"
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sortable-block"
      data-indent={block.indent} // Store indent as data attribute
      data-group-id={block.groupId || ""} // Store group ID for identifying related blocks
      data-id={id} // Add ID for dimension capturing
    >
      <BlockItem
        block={block}
        language={language}
        isDragging={isDragging}
        indentWidth={indentWidth}
        maxIndent={maxIndent}
        blockWidth={100} // Use 100% of parent's width which is already calculated
        onContentChange={onContentChange}
        onRemove={onRemove}
        onAddAlternative={onAddAlternative}
        onCorrectChange={onCorrectChange}
        showCorrectCheckbox={Boolean(block.groupId)} // Only show checkbox for blocks in a group
        hasAlternatives={hasAlternatives}
        showAddAlternative={showAddAlternative}
        showDragHandle={showDragHandle}
        dragHandleProps={showDragHandle ? { ref: handleRef, attributes, listeners } : undefined}
      />
    </div>
  );
};
