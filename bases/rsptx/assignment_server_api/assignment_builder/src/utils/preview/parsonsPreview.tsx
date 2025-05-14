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

    if (groupBlocks.length > 1) {
      const alternatives = groupBlocks
        .filter((b) => b.id !== correctBlock.id)
        .map((b) => b.content.trim())
        .join(" || ");

      let mergedContent = correctBlock.content.trim();

      if (alternatives) {
        mergedContent += ` || ${alternatives}`;
      }

      processedBlocks.push({
        ...correctBlock,
        content: mergedContent
      });
    } else {
      processedBlocks.push(correctBlock);
    }
  });

  const blockOrder = blocks.filter((b) => !b.groupId).map((b) => b.id);
  const groupOrder: string[] = [];

  blocks.forEach((block) => {
    if (block.groupId && !groupOrder.includes(block.groupId)) {
      groupOrder.push(block.groupId);
    }
  });

  const orderedBlocks = [...processedBlocks];

  orderedBlocks.sort((a, b) => {
    if (!a.groupId && !b.groupId) {
      return blockOrder.indexOf(a.id) - blockOrder.indexOf(b.id);
    }
    else if (a.groupId && !b.groupId) {
      return groupOrder.indexOf(a.groupId) - blockOrder.indexOf(b.id);
    }
    else if (!a.groupId && b.groupId) {
      return blockOrder.indexOf(a.id) - groupOrder.indexOf(b.groupId);
    }
    else if (a.groupId && b.groupId) {
      return groupOrder.indexOf(a.groupId) - groupOrder.indexOf(b.groupId);
    }
    return 0;
  });

  const shuffledBlocks = [...orderedBlocks].sort(() => Math.random() - 0.5);

  const blocksContent = shuffledBlocks
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
