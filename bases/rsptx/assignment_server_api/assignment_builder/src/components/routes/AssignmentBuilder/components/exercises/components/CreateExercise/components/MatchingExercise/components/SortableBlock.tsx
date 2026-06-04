import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ActionIcon, Tooltip } from "@mantine/core";
import { FC, useCallback, useMemo } from "react";

import { Icon } from "@/components/ui/Icon";

import { ConnectHandle, ConnectTargetButton } from "../../../shared/connections";
import { REMOVE_BLOCK_CONFIRM, confirmRemoval } from "../../../utils/removeConfirm";
import { isTipTapContentEmpty } from "../../../utils/validation";
import styles from "../MatchingExercise.module.css";
import { DragBlock } from "../types";

export interface SortableBlockProps {
  block: DragBlock;
  onUpdate: (id: string, content: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  isLeft: boolean;
  onStartConnection?: (sourceId: string) => void;
  onCancelConnection?: () => void;
  isConnectTarget?: boolean;
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
  onCancelConnection,
  isConnectTarget = false,
  onCompleteConnection,
  activeSource,
  connections,
  index
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    transition: { duration: 250, easing: "var(--rs-spring-snappy)" }
  });

  const baseTransform = CSS.Transform.toString(transform);
  const style = {
    transform: isDragging && baseTransform ? `${baseTransform} scale(0.98)` : baseTransform,
    transition,
    zIndex: isDragging ? 1 : undefined
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
        ${isConnectTarget ? styles.rightTarget : ""} 
        ${isConnected ? styles.connectedBlock : ""}`}
      data-block-id={block.id}
      data-dragging={isDragging || undefined}
      data-connected={isConnected ? "true" : "false"}
      data-index={index}
      onClick={
        isConnectTarget && onCompleteConnection ? () => onCompleteConnection(block.id) : undefined
      }
    >
      <div className={styles.blockIndex}>{index + 1}</div>
      {isConnectTarget && onCompleteConnection && (
        <ConnectTargetButton
          blockId={block.id}
          ariaLabel={`Connect to ${isLeft ? "source item" : "target match"} ${index + 1}`}
          className={styles.connectTargetButton}
          onComplete={onCompleteConnection}
        />
      )}
      {!isLeft && onStartConnection && (
        <ConnectHandle
          blockId={block.id}
          ariaLabel={`Connect target match ${index + 1} to a source item`}
          isActive={activeSource === block.id}
          isConnected={!!isConnected}
          direction="left"
          className={`${styles.connectionHandleLeft}
            ${activeSource === block.id ? styles.activeConnectionHandle : ""}
            ${isConnected ? styles.connectedHandle : ""}`}
          onStart={onStartConnection}
          onCancel={onCancelConnection || (() => undefined)}
        />
      )}
      <div
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <Icon name="bars" size={14} />
      </div>
      <div className={styles.blockContent}>
        <Editor content={block.content} onChange={handleContentChange} />
        {isConnected && connectionPartnerIds.length > 0 && (
          <div
            className={styles.connectionBadge}
            title={
              connectionCount === 1
                ? `Connected to block ${connectionPartnerIds[0].replace(/^(left|right)-/, "")}`
                : `Connected to ${connectionCount} ${isLeft ? "target" : "source"}${connectionCount > 1 ? "s" : ""}`
            }
          >
            <Icon name="link" size={12} color="currentColor" />
            {connectionCount > 1 && <span>{connectionCount}</span>}
          </div>
        )}
      </div>
      <div className={styles.blockActions}>
        <Tooltip label="Remove block" position="left">
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() =>
              confirmRemoval({
                hasContent: !isTipTapContentEmpty(block.content || ""),
                ...REMOVE_BLOCK_CONFIRM,
                onConfirm: () => onRemove(block.id)
              })
            }
            disabled={!canRemove}
            aria-label="Remove block"
          >
            <Icon name="trash" size={14} color="currentColor" />
          </ActionIcon>
        </Tooltip>
        {isLeft && onStartConnection && (
          <ConnectHandle
            blockId={block.id}
            ariaLabel={`Connect source item ${index + 1} to a target match`}
            isActive={activeSource === block.id}
            isConnected={!!isConnected}
            direction="right"
            className={`${styles.connectionHandle}
              ${activeSource === block.id ? styles.activeConnectionHandle : ""}
              ${isConnected ? styles.connectedHandle : ""}`}
            onStart={onStartConnection}
            onCancel={onCancelConnection || (() => undefined)}
          />
        )}
      </div>
    </div>
  );
};
