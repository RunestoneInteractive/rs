export const CONNECTION_TOAST_COPY = {
  sameSideTitle: "Can't connect these",
  sameSideMessage:
    "Connections pair a source item with a target match. Pick items from opposite columns.",
  duplicateTitle: "Already connected",
  duplicateMessage: "These two items are already connected."
};

export interface ConnectionBlockItem {
  id: string;
  label: string;
}

export type ConnectionSide = "left" | "right";

export const blockSide = (
  left: ConnectionBlockItem[],
  right: ConnectionBlockItem[],
  blockId: string
): ConnectionSide => {
  if (left.some((item) => item.id === blockId)) return "left";
  if (right.some((item) => item.id === blockId)) return "right";
  return blockId.startsWith("left-") ? "left" : "right";
};

export const connectionExistsBetween = (
  connections: string[][],
  leftId: string,
  rightId: string
): boolean => connections.some(([source, target]) => source === leftId && target === rightId);

const MAX_LABEL_LENGTH = 40;

export const blockLabelText = (html: string, fallback: string): string => {
  const text = (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return fallback;
  if (text.length <= MAX_LABEL_LENGTH) return text;
  return `${text.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`;
};

export const makeConnectionLabelResolver =
  (left: ConnectionBlockItem[], right: ConnectionBlockItem[]) =>
  (blockId: string): string => {
    const leftIndex = left.findIndex((item) => item.id === blockId);

    if (leftIndex >= 0) {
      return blockLabelText(left[leftIndex].label, `Source item ${leftIndex + 1}`);
    }

    const rightIndex = right.findIndex((item) => item.id === blockId);

    if (rightIndex >= 0) {
      return blockLabelText(right[rightIndex].label, `Target match ${rightIndex + 1}`);
    }

    return blockId;
  };
