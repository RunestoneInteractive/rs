export interface ParsonsBlock {
  id: string;
  content: string;
  indent: number;
  isDistractor?: boolean;
  isPaired?: boolean;
  groupId?: string; // ID группы альтернативных блоков
  isCorrect?: boolean; // Флаг для отметки правильного блока в группе
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

  // Process blocks to handle groups
  const processedBlocks: ParsonsBlock[] = [];
  const groupMap: Record<string, ParsonsBlock[]> = {};

  // First, collect all blocks by groups
  blocks.forEach((block) => {
    if (block.groupId) {
      if (!groupMap[block.groupId]) {
        groupMap[block.groupId] = [];
      }
      groupMap[block.groupId].push(block);
    } else {
      // Non-grouped blocks go directly to processed blocks
      processedBlocks.push(block);
    }
  });

  // Process groups and add them to processedBlocks
  Object.values(groupMap).forEach((groupBlocks) => {
    // Find the correct block in the group or use the first one
    const correctBlock = groupBlocks.find((b) => b.isCorrect) || groupBlocks[0];

    if (groupBlocks.length > 1) {
      // Create a merged block with OR operators
      const alternatives = groupBlocks
        .filter((b) => b.id !== correctBlock.id)
        .map((b) => b.content.trim())
        .join(" || ");

      // Only add the OR operator if there are alternatives
      let mergedContent = correctBlock.content.trim();

      if (alternatives) {
        mergedContent += ` || ${alternatives}`;
      }

      // Create a new block with the merged content
      processedBlocks.push({
        ...correctBlock,
        content: mergedContent
      });
    } else {
      // Only one block in group, add it directly
      processedBlocks.push(correctBlock);
    }
  });

  // Sort blocks to maintain original order
  const blockOrder = blocks.filter((b) => !b.groupId).map((b) => b.id);
  const groupOrder: string[] = [];

  blocks.forEach((block) => {
    if (block.groupId && !groupOrder.includes(block.groupId)) {
      groupOrder.push(block.groupId);
    }
  });

  // Combine all blocks in the original order
  const orderedBlocks = [...processedBlocks];

  orderedBlocks.sort((a, b) => {
    // If both are standalone blocks
    if (!a.groupId && !b.groupId) {
      return blockOrder.indexOf(a.id) - blockOrder.indexOf(b.id);
    }
    // If only a is a group block
    else if (a.groupId && !b.groupId) {
      return groupOrder.indexOf(a.groupId) - blockOrder.indexOf(b.id);
    }
    // If only b is a group block
    else if (!a.groupId && b.groupId) {
      return blockOrder.indexOf(a.id) - groupOrder.indexOf(b.groupId);
    }
    // If both are group blocks
    else if (a.groupId && b.groupId) {
      return groupOrder.indexOf(a.groupId) - groupOrder.indexOf(b.groupId);
    }
    return 0;
  });

  // Sort and shuffle the blocks for the preview
  const shuffledBlocks = [...orderedBlocks].sort(() => Math.random() - 0.5);

  // Generate the blocks content
  const blocksContent = shuffledBlocks
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
