import { ActionIcon, Tooltip } from "@mantine/core";
import { FC, KeyboardEvent, MouseEvent } from "react";

import { Icon } from "@/components/ui/Icon";

export interface ConnectHandleProps {
  blockId: string;
  ariaLabel: string;
  isActive: boolean;
  isConnected: boolean;
  direction: "left" | "right";
  className?: string;
  onStart: (blockId: string) => void;
  onCancel: () => void;
}

const KEYBOARD_CLICK_DETAIL = 0;

export const ConnectHandle: FC<ConnectHandleProps> = ({
  blockId,
  ariaLabel,
  isActive,
  isConnected,
  direction,
  className,
  onStart,
  onCancel
}) => {
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onStart(blockId);
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== KEYBOARD_CLICK_DETAIL) return;
    if (isActive) {
      onCancel();
      return;
    }
    onStart(blockId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && isActive) {
      onCancel();
    }
  };

  const tooltip = isActive
    ? "Connect mode is on. Pick a target or press again to cancel"
    : "Drag to a target, or press to turn on connect mode";

  return (
    <Tooltip label={tooltip} events={{ hover: true, focus: true, touch: true }}>
      <ActionIcon
        variant="subtle"
        className={className}
        aria-label={ariaLabel}
        aria-pressed={isActive}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <Icon
          name={isConnected ? "link" : `circle-arrow-${direction}`}
          size={14}
          color="currentColor"
        />
      </ActionIcon>
    </Tooltip>
  );
};
