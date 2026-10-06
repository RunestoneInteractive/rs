import { extractParsonsSource } from "./extractParsonsSource";
import { parseParsonsHash } from "./parseParsonsHash";

const formatLegacyAnswer = (answer: string): string =>
  answer
    .replace(/\r\n?/g, "\n")
    .replace(/(?:^|\n)[ \t]*---[ \t]*(?:\n|$)/g, "\n")
    .trim();

export const reconstructParsonsAnswer = (
  answer?: string | null,
  htmlsrc?: string
): string | null => {
  const normalizedAnswer = answer ?? "";
  const blocks = parseParsonsHash(normalizedAnswer);

  if (blocks === null) return formatLegacyAnswer(normalizedAnswer);
  if (blocks.length === 0) return "";

  const source = extractParsonsSource(htmlsrc);

  if (!source) return null;

  const output: string[] = [];

  for (const block of blocks) {
    const lines = block.lineIndexes.map((lineIndex) => source.lines[lineIndex]);

    if (lines.some((line) => line === undefined)) return null;

    const definedLines = lines.filter((line) => line !== undefined);
    const sourceIndent = Math.min(...definedLines.map(({ indentLevel }) => indentLevel));

    for (const line of definedLines) {
      const indentLevel = source.noIndent
        ? line.indentLevel
        : line.indentLevel - sourceIndent + block.indent;
      const indentation = line.text ? source.indentUnit.repeat(Math.max(0, indentLevel)) : "";

      output.push(`${indentation}${line.text}`);
    }
  }

  return output.join("\n");
};
