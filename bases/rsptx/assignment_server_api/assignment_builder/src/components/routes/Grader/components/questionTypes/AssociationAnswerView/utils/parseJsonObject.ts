export const parseJsonObject = (answer: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(answer);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};
