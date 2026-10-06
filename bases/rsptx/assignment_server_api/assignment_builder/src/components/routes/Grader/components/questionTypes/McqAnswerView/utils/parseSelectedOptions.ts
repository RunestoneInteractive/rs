export const parseSelectedOptions = (answer: string): string[] =>
  (answer || "").split(",").filter(Boolean);
