export const safeJsonParse = <T>(value: string | object): T | undefined => {
  if (typeof value === "object" && value !== null) {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};
