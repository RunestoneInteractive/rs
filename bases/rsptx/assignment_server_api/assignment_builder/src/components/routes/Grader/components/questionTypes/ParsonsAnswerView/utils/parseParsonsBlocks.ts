export const parseParsonsBlocks = (answer: string): string[] =>
  (answer || "")
    .split("-")
    .map((block) => block.trim())
    .filter(Boolean);
