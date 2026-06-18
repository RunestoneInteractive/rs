import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";

export interface ConfirmRemovalOptions {
  hasContent: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export const confirmRemoval = ({
  hasContent,
  title,
  message,
  onConfirm
}: ConfirmRemovalOptions) => {
  if (!hasContent) {
    onConfirm();
    return;
  }

  modals.openConfirmModal({
    title,
    children: <Text size="sm">{message}</Text>,
    labels: { confirm: "Remove", cancel: "Cancel" },
    confirmProps: { color: "red" },
    onConfirm
  });
};

export const REMOVE_OPTION_CONFIRM = {
  title: "Remove option",
  message: "Remove this option? Its content can't be restored."
} as const;

export const REMOVE_BLOCK_CONFIRM = {
  title: "Remove block",
  message: "Remove this block? Its content can't be restored."
} as const;
