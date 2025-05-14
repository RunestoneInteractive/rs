import { ParsonsBlock } from "../preview/parsonsPreview";

interface ParsonsExerciseData {
  name: string;
  instructions: string;
  blocks: ParsonsBlock[];
  language: string;
  adaptive?: boolean;
  numbered?: "left" | "right" | "none";
  noindent?: boolean;
  questionLabel?: string;
}

export const generateParsonsHtmlSrc = ({
  name,
  instructions,
  blocks,
  language = "python",
  adaptive = true,
  numbered = "left",
  noindent = false,
  questionLabel
}: ParsonsExerciseData): string => {
  const safeId = name.replace(/\s+/g, "_").replace(/[^\w]/g, "");

  const blocksContent = blocks
    .map((block) => {
      let blockContent = block.content.trim();

      if (block.isDistractor) {
        blockContent += " #distractor";
      } else if (block.isPaired) {
        blockContent += " #paired";
      }

      return blockContent;
    })
    .join("\n---\n");

  let optionsString = "";

  if (language) {
    optionsString += ` data-language="${language}"`;
  }

  const label = questionLabel || name;

  if (adaptive) {
    optionsString += ' data-adaptive="true"';
  }

  if (numbered !== "none") {
    optionsString += ` data-numbered="${numbered}"`;
  }

  if (noindent) {
    optionsString += ' data-noindent="true"';
  }

  return `
<div class="runestone parsons-container">
  <div data-component="parsons" id="${safeId}" class="parsons">
    <div class="parsons_question parsons-text">
${instructions}
    </div>
    <pre class="parsonsblocks" data-question_label="${label}"${optionsString} style="visibility: hidden;">
${blocksContent}
    </pre>
  </div>
</div>`;
};
