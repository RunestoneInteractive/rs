export const isEmptyObject = <T extends object>(obj: T): boolean => {
  return Object.keys(obj).length === 0;
};

export const dumpObject = (data: unknown, spacing: number = 2): string => {
  try {
    return JSON.stringify(data, null, spacing);
  } catch (error) {
    return `Error: Unable to serialize the provided data - ${error}`;
  }
};
