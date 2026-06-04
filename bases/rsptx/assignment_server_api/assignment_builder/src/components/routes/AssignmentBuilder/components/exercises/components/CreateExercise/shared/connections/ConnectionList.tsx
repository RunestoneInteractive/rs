import { ActionIcon, Tooltip } from "@mantine/core";
import { FC } from "react";

import { Icon } from "@/components/ui/Icon";

import styles from "./ConnectionList.module.css";

export interface ConnectionListProps {
  connections: string[][];
  resolveLabel: (blockId: string) => string;
  onRemove: (sourceId: string, targetId: string) => void;
}

export const ConnectionList: FC<ConnectionListProps> = ({
  connections,
  resolveLabel,
  onRemove
}) => {
  return (
    <div className={styles.connectionList}>
      <h4 className={styles.connectionListTitle}>Connections ({connections.length})</h4>
      {connections.length === 0 ? (
        <p className={styles.connectionListEmpty}>
          No connections yet. Drag from a connect handle, or press it and pick a target.
        </p>
      ) : (
        <ul className={styles.connectionListItems} aria-label="Connections">
          {connections.map(([sourceId, targetId]) => {
            const sourceLabel = resolveLabel(sourceId);
            const targetLabel = resolveLabel(targetId);

            return (
              <li key={`${sourceId}-${targetId}`} className={styles.connectionRow} tabIndex={0}>
                <span className={styles.connectionRowLabel}>{sourceLabel}</span>
                <Icon name="arrow-right" size={14} color="currentColor" />
                <span className={styles.connectionRowLabel}>{targetLabel}</span>
                <Tooltip
                  label="Remove connection"
                  events={{ hover: true, focus: true, touch: true }}
                >
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    className={styles.connectionRowRemove}
                    aria-label={`Remove connection from ${sourceLabel} to ${targetLabel}`}
                    onClick={() => onRemove(sourceId, targetId)}
                  >
                    <Icon name="trash" size={14} color="currentColor" />
                  </ActionIcon>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
