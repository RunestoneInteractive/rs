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

/**
 * Generate HTML source for a Parsons exercise
 * This function generates the HTML that will be saved to the database
 * It follows the same format as the one used for previewing exercises
 */
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

  // Generate the blocks content
  const blocksContent = blocks
    .map((block) => {
      let blockContent = block.content.trim();

      // Add distractor or paired marker if needed
      if (block.isDistractor) {
        blockContent += " #distractor";
      } else if (block.isPaired) {
        blockContent += " #paired";
      }

      return blockContent;
    })
    .join("\n---\n");

  // Create the options string for the parsons component
  let optionsString = "";

  // Add language option if specified
  if (language) {
    optionsString += ` data-language="${language}"`;
  }

  // Add the question label (defaults to name if not provided)
  const label = questionLabel || name;

  // Add adaptive option if enabled
  if (adaptive) {
    optionsString += ' data-adaptive="true"';
  }

  // Add numbered option if specified
  if (numbered !== "none") {
    optionsString += ` data-numbered="${numbered}"`;
  }

  // Add noindent option if enabled
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
