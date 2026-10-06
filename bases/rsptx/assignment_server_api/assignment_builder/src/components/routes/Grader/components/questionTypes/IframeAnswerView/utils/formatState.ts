export const formatState = (state: unknown): string => {
  if (state == null || state === "") return "(no state recorded)";
  if (typeof state === "string") return state;
  try {
    return JSON.stringify(state, null, 2);
  } catch {
    return String(state);
  }
};
