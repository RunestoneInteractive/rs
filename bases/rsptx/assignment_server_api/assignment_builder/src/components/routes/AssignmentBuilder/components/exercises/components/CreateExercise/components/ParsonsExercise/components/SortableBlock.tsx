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
  onSplitBlock?: (id: string, lineIndex: number) => void;
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
  onSplitBlock,
  hasAlternatives,
  showAddAlternative = true,
  showDragHandle = true
}) => {
  const handleRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,

    data: {
      type: "parsons-block",
      block,
      groupId: block.groupId
    },

    attributes: {
      role: "button",
      tabIndex: 0
    }
  });

  const style = {
    marginLeft: !isDragging && !hasAlternatives ? `${block.indent * indentWidth}px` : 0,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : 0,
    flex: hasAlternatives ? `0 0 ${blockWidth}%` : 1,
    width: `${blockWidth}%`,
    minWidth: hasAlternatives ? "200px" : undefined,
    maxWidth: hasAlternatives ? undefined : "800px"
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sortable-block"
      data-indent={block.indent}
      data-group-id={block.groupId || ""}
      data-id={id}
    >
      <BlockItem
        block={block}
        language={language}
        isDragging={isDragging}
        indentWidth={indentWidth}
        maxIndent={maxIndent}
        blockWidth={100}
        onContentChange={onContentChange}
        onRemove={onRemove}
        onAddAlternative={onAddAlternative}
        onCorrectChange={onCorrectChange}
        onSplitBlock={onSplitBlock}
        showCorrectCheckbox={Boolean(block.groupId)}
        hasAlternatives={hasAlternatives}
        showAddAlternative={showAddAlternative}
        showDragHandle={showDragHandle}
        dragHandleProps={showDragHandle ? { ref: handleRef, attributes, listeners } : undefined}
      />
    </div>
  );
};
