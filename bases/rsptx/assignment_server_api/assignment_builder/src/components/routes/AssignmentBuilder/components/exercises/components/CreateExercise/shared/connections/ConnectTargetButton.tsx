import { ActionIcon, Tooltip } from "@mantine/core";
import { FC, MouseEvent } from "react";

import { Icon } from "@/components/ui/Icon";

import styles from "./ConnectTargetButton.module.css";

export interface ConnectTargetButtonProps {
  blockId: string;
  ariaLabel: string;
  className?: string;
  onComplete: (blockId: string) => void;
}

export const ConnectTargetButton: FC<ConnectTargetButtonProps> = ({
  blockId,
  ariaLabel,
  className,
  onComplete
}) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onComplete(blockId);
  };

  return (
    <Tooltip label="Connect here" events={{ hover: true, focus: true, touch: true }}>
      <ActionIcon
        variant="subtle"
        className={`${styles.connectTarget} ${className || ""}`}
        aria-label={ariaLabel}
        onClick={handleClick}
      >
        <Icon name="link" size={14} color="currentColor" />
      </ActionIcon>
    </Tooltip>
  );
};
