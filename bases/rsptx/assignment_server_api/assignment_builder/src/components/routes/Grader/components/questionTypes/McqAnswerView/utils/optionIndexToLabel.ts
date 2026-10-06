/** Convert a zero-based Runestone option index to its displayed letter. */
export const optionIndexToLabel = (value: string): string => {
  if (!/^\d+$/.test(value)) return value;

  let index = Number(value);

  if (!Number.isSafeInteger(index)) return value;

  let label = "";

  do {
    label = String.fromCharCode(65 + (index % 26)) + label;
    index = Math.floor(index / 26) - 1;
  } while (index >= 0);

  return label;
};
