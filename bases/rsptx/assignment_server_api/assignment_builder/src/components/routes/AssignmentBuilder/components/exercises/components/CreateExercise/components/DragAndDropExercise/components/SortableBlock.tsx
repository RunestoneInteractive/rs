import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "primereact/button";
import { FC, useCallback, useMemo } from "react";

import styles from "../DragAndDropExercise.module.css";
import { DragBlock } from "../types";

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
  connections?: string[][];
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
      (conn) => (isLeft && conn[0] === block.id) || (!isLeft && conn[1] === block.id)
    );
  }, [connections, block.id, isLeft]);

  const connectionPartnerIds = useMemo(() => {
    if (!connections) return [];

    if (isLeft) {
      return connections.filter((conn) => conn[0] === block.id).map((conn) => conn[1]);
    } else {
      return connections.filter((conn) => conn[1] === block.id).map((conn) => conn[0]);
    }
  }, [connections, block.id, isLeft]);

  const connectionCount = useMemo(() => {
    if (connections) {
      if (isLeft) {
        return connections.filter((conn) => conn[0] === block.id).length;
      } else {
        return connections.filter((conn) => conn[1] === block.id).length;
      }
    }
    return 0;
  }, [connections, block.id, isLeft]);

  const isValidTarget = useMemo(() => {
    if (!isRightTarget || activeSource === null) return false;

    const connectionExists = connections?.some(
      (conn) => conn[0] === activeSource && conn[1] === block.id
    );

    return !connectionExists;
  }, [isRightTarget, connections, block.id, activeSource]);

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
        {isConnected && connectionPartnerIds.length > 0 && (
          <div
            className={styles.connectionBadge}
            title={
              connectionCount === 1
                ? `Connected to block ${connectionPartnerIds[0].replace(/^(left|right)-/, "")}`
                : `Connected to ${connectionCount} ${isLeft ? "target" : "source"}${connectionCount > 1 ? "s" : ""}`
            }
          >
            <i className="fa-solid fa-link mr-1" />
            {connectionCount > 1 && <span>{connectionCount}</span>}
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
