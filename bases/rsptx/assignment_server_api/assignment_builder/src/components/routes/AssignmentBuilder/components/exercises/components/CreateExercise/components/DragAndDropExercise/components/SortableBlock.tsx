import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "primereact/button";
import { FC, useCallback, useMemo } from "react";

import styles from "../DragAndDropExercise.module.css";
import { DragBlock, BlockConnection } from "../types";

export interface SortableBlockProps {
  block: DragBlock;
  onUpdate: (id: string, content: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  isLeft: boolean;
  onStartConnection?: (sourceId: string) => void;
  isRightTarget?: boolean;
  onCompleteConnection?: (targetId: string) => void;
  activeSource: string | null;
  connections?: BlockConnection[];
  index: number;
}

export const SortableBlock: FC<SortableBlockProps> = ({
  block,
  onUpdate,
  onRemove,
  canRemove,
  isLeft,
  onStartConnection,
  isRightTarget,
  onCompleteConnection,
  activeSource,
  connections,
  index
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const isConnected = useMemo(() => {
    return connections?.some(
      (conn) => (isLeft && conn.sourceId === block.id) || (!isLeft && conn.targetId === block.id)
    );
  }, [connections, block.id, isLeft]);

  const connectionPartnerId = useMemo(() => {
    if (!isConnected || !connections) return null;

    const connection = connections.find((conn) =>
      isLeft ? conn.sourceId === block.id : conn.targetId === block.id
    );

    return isLeft ? connection?.targetId : connection?.sourceId;
  }, [isConnected, connections, block.id, isLeft]);

  const isValidTarget = useMemo(() => {
    return isRightTarget && !isConnected && activeSource !== null;
  }, [isRightTarget, isConnected, activeSource]);

  const handleContentChange = useCallback(
    (content: string) => {
      onUpdate(block.id, content);
    },
    [block.id, onUpdate]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.blockContainer} 
        ${isValidTarget ? styles.rightTarget : ""} 
        ${isConnected ? styles.connectedBlock : ""}`}
      data-block-id={block.id}
      data-connected={isConnected ? "true" : "false"}
      data-index={index}
      onClick={
        isValidTarget && onCompleteConnection ? () => onCompleteConnection(block.id) : undefined
      }
    >
      <div className={styles.blockIndex}>{index + 1}</div>
      <div
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <i className="fa-solid fa-grip-vertical" />
      </div>
      <div className={styles.blockContent}>
        <Editor
          content={block.content}
          onChange={handleContentChange}
          placeholder="Enter content..."
        />
        {isConnected && connectionPartnerId && (
          <div
            className={styles.connectionBadge}
            title={`Connected to block ${connectionPartnerId.replace(/^(left|right)-/, "")}`}
          >
            <i className="fa-solid fa-link mr-1" />
          </div>
        )}
      </div>
      <div className={styles.blockActions}>
        <Button
          icon="fa-solid fa-trash"
          severity="danger"
          text
          onClick={() => onRemove(block.id)}
          disabled={!canRemove}
          tooltip="Remove block"
          tooltipOptions={{ position: "left" }}
          aria-label="Remove block"
          className={styles.iconButton}
          style={{ color: "#ef4444" }}
        />
        {isLeft && onStartConnection && (
          <div
            className={`${styles.connectionHandle} 
              ${activeSource === block.id ? styles.activeConnectionHandle : ""} 
              ${isConnected ? styles.connectedHandle : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartConnection(block.id);
            }}
            title={isConnected ? "Connected - click to modify" : "Drag to connect with right block"}
          >
            <i className={`fa-solid ${isConnected ? "fa-link" : "fa-circle-arrow-right"}`} />
          </div>
        )}
      </div>
    </div>
  );
};
