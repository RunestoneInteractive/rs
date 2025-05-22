export interface ParsonsBlock {
  id: string;
  content: string;
  indent: number;
  isDistractor?: boolean;
  isPaired?: boolean;
  groupId?: string;
  isCorrect?: boolean;
}

export interface ParsonsPreviewProps {
  instructions: string;
  blocks: ParsonsBlock[];
  name: string;
  language?: string;
  adaptive?: boolean;
  numbered?: "left" | "right" | "none";
  noindent?: boolean;
  questionLabel?: string;
}

export const generateParsonsPreview = ({
  instructions,
  blocks,
  name,
  language = "python",
  adaptive = true,
  numbered = "left",
  noindent = false,
  questionLabel
}: ParsonsPreviewProps): string => {
  const safeId = name.replace(/\s+/g, "_").replace(/[^\w]/g, "");

  const processedBlocks: ParsonsBlock[] = [];
  const groupMap: Record<string, ParsonsBlock[]> = {};

  blocks.forEach((block) => {
    if (block.groupId) {
      if (!groupMap[block.groupId]) {
        groupMap[block.groupId] = [];
      }
      groupMap[block.groupId].push(block);
    } else {
      processedBlocks.push(block);
    }
  });

  Object.values(groupMap).forEach((groupBlocks) => {
    const correctBlock = groupBlocks.find((b) => b.isCorrect) || groupBlocks[0];

    processedBlocks.push({
      ...correctBlock,
      content: correctBlock.content.trim()
    });

    groupBlocks
      .filter((b) => b.id !== correctBlock.id)
      .forEach((altBlock) => {
        processedBlocks.push({
          ...altBlock,
          content: altBlock.content.trim(),
          isPaired: true,
          isDistractor: true
        });
      });
  });

  const blocksContent = processedBlocks
    .map((block) => {
      let blockContent = block.content;

      if (blockContent.includes("\n")) {
        const lines = blockContent.split("\n");

        blockContent = lines
          .map((line, i) => {
            if (i === 0) return line;
            return " ".repeat(block.indent * 4) + line;
          })
          .join("\n");
      }

      if (block.isDistractor) {
        blockContent += block.isPaired ? " #paired" : " #distractor";
      }

      return blockContent;
    })
    .join("\n---\n");

  let dataAttributes = "";

  if (language) {
    dataAttributes += ` data-language="${language}"`;
  }

  if (adaptive) {
    dataAttributes += ' data-adaptive="true"';
  }

  if (numbered !== "none") {
    dataAttributes += ` data-numbered="${numbered}"`;
  }

  if (noindent) {
    dataAttributes += ' data-noindent="true"';
  }

  return `
<div class="runestone">
  <div data-component="parsons" id="${safeId}" class="parsons">
    <div class="parsons_question">
      ${instructions}
    </div>
    <pre class="parsonsblocks" data-question_label="${questionLabel || name}"${dataAttributes}>
${blocksContent}
    </pre>  
  </div>
</div>`;
};
