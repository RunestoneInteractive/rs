import { ParsonsHashBlock } from "../types";

const HASH_PATTERN = /^\d+(?:_\d+)+(?:-\d+(?:_\d+)+)*$/;

export const parseParsonsHash = (answer?: string | null): ParsonsHashBlock[] | null => {
  const hash = answer?.trim() ?? "";

  if (!hash || hash === "-") return [];
  if (!HASH_PATTERN.test(hash)) return null;

  return hash.split("-").map((encodedBlock) => {
    const values = encodedBlock.split("_").map(Number);

    return {
      lineIndexes: values.slice(0, -1),
      indent: values.at(-1) ?? 0
    };
  });
};
