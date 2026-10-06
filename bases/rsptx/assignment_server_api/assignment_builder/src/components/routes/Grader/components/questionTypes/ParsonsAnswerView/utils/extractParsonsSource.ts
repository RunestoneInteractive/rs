import { DEFAULT_PARSONS_INDENT } from "../constants";
import { ParsonsSource, ParsonsSourceLine } from "../types";

interface UnnormalizedLine {
  indent: number;
  leadingWhitespace: string;
  text: string;
}

const greatestCommonDivisor = (left: number, right: number): number =>
  right === 0 ? left : greatestCommonDivisor(right, left % right);

const removeBlockMetadata = (block: string): string =>
  block
    .replace(/\s*#(?:paired|distractor)(?::[^\r\n]*)?\s*$/i, "")
    .replace(/\s*#tag:.*?;depends:.*?;\s*$/i, "");

const sourceLinesFromText = (sourceText: string): UnnormalizedLine[] => {
  const normalized = sourceText.replace(/\r\n?/g, "\n").trim();
  let blocks = normalized.split("---");

  if (blocks.length === 1) blocks = normalized.split("\n");

  return blocks.flatMap((rawBlock) => {
    const lines = removeBlockMetadata(rawBlock).split("\n");

    return lines.flatMap((line, index) => {
      const isBoundaryBlank = /^\s*$/.test(line) && (index === 0 || index === lines.length - 1);

      if (isBoundaryBlank) return [];

      const withoutTrailingWhitespace = line.replace(/\s*$/, "");
      const leadingWhitespace = withoutTrailingWhitespace.match(/^\s*/)?.[0] ?? "";

      return [
        {
          indent: leadingWhitespace.length,
          leadingWhitespace,
          text: withoutTrailingWhitespace.slice(leadingWhitespace.length)
        }
      ];
    });
  });
};

const inferIndentUnit = (lines: UnnormalizedLine[]): string => {
  const nonEmptyIndents = lines.filter(({ text }) => text).map(({ indent }) => indent);
  const positiveIndents = nonEmptyIndents.filter((indent) => indent > 0);

  if (positiveIndents.length === 0) return DEFAULT_PARSONS_INDENT;

  const indentedWhitespace = lines
    .filter(({ text, indent }) => text && indent > 0)
    .map(({ leadingWhitespace }) => leadingWhitespace);

  if (indentedWhitespace.every((whitespace) => /^\t+$/.test(whitespace))) return "\t";

  const width = positiveIndents.reduce(greatestCommonDivisor);

  return " ".repeat(width || DEFAULT_PARSONS_INDENT.length);
};

export const extractParsonsSource = (htmlsrc?: string): ParsonsSource | null => {
  if (!htmlsrc) return null;

  const document = new DOMParser().parseFromString(htmlsrc, "text/html");
  const sourceElement = document.querySelector("pre.parsonsblocks");

  if (!sourceElement) return null;

  const sourceLines = sourceLinesFromText(sourceElement.textContent ?? "");
  const indentValues = [...new Set(sourceLines.map(({ indent }) => indent))].sort(
    (left, right) => left - right
  );
  const lines: ParsonsSourceLine[] = sourceLines.map(({ indent, text }) => ({
    indentLevel: indentValues.indexOf(indent),
    text
  }));

  return {
    indentUnit: inferIndentUnit(sourceLines),
    lines,
    noIndent: sourceElement.hasAttribute("data-noindent")
  };
};
