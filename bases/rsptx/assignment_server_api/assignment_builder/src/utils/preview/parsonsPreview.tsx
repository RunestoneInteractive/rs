import { sanitizeId } from "../sanitize";

export interface ParsonsBlock {
  id: string;
  content: string;
  indent: number;
  isDistractor?: boolean;
  isPaired?: boolean;
  groupId?: string;
  isCorrect?: boolean;
  tag?: string;
  depends?: string[];
  explanation?: string;
  displayOrder?: number;
  pairedWithBlockAbove?: boolean;
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
  grader?: "line" | "dag";
  orderMode?: "random" | "custom";
  customOrder?: number[];
}

export const generateParsonsPreview = ({
  instructions,
  blocks,
  name,
  language = "python",
  adaptive = true,
  numbered = "left",
  noindent = false,
  questionLabel,
  grader = "line",
  orderMode = "random",
  customOrder
}: ParsonsPreviewProps): string => {
  const safeId = sanitizeId(name);

  const processedBlocks: ParsonsBlock[] = [];
  const seenGroupIds = new Set<string>();

  blocks.forEach((block) => {
    if (!block.groupId) {
      processedBlocks.push(block);
      return;
    }
    if (seenGroupIds.has(block.groupId)) return;

    seenGroupIds.add(block.groupId);
    const groupBlocks = blocks.filter((b) => b.groupId === block.groupId);
    const correctBlock = groupBlocks.find((b) => b.isCorrect) || groupBlocks[0];

    processedBlocks.push({
      ...correctBlock,
      content: correctBlock.content.replace(/\s+$/, "")
    });

    groupBlocks
      .filter((b) => b.id !== correctBlock.id)
      .forEach((altBlock) => {
        processedBlocks.push({
          ...altBlock,
          content: altBlock.content.replace(/\s+$/, ""),
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

      // Add DAG tag/depends annotations for non-distractor blocks
      if (grader === "dag" && !block.isDistractor && block.tag) {
        const dependsStr = block.depends?.length ? block.depends.join(",") : "";
        blockContent += ` #tag:${block.tag}; depends:${dependsStr};`;
      }

      if (block.isDistractor) {
        // isPaired is set automatically for grouped alternatives,
        // pairedWithBlockAbove is set by the user for standalone distractors
        const marker = block.isPaired || block.pairedWithBlockAbove ? "#paired" : "#distractor";
        blockContent += block.explanation ? ` ${marker}: ${block.explanation}` : ` ${marker}`;
      }

      return blockContent;
    })
    .join("\n---\n");

  let dataAttributes = "";

  if (language) {
    dataAttributes += ` data-language="${language}"`;
  }

  if (adaptive && grader !== "dag") {
    dataAttributes += ' data-adaptive="true"';
  }

  if (numbered !== "none") {
    dataAttributes += ` data-numbered="${numbered}"`;
  }

  if (noindent) {
    dataAttributes += ' data-noindent="true"';
  }

  if (grader === "dag") {
    dataAttributes += ' data-grader="dag"';
  }

  if (orderMode === "custom") {
    // Build order from block displayOrder values
    // First, compute the "logical block" indices (grouped blocks count as one)
    const logicalBlocks: { displayOrder?: number; originalIndex: number }[] = [];
    const seenGroupsForOrder = new Set<string>();
    let logicalIdx = 0;
    blocks.forEach((block) => {
      if (block.groupId) {
        if (!seenGroupsForOrder.has(block.groupId)) {
          seenGroupsForOrder.add(block.groupId);
          logicalBlocks.push({ displayOrder: block.displayOrder, originalIndex: logicalIdx });
          logicalIdx++;
        }
      } else {
        logicalBlocks.push({ displayOrder: block.displayOrder, originalIndex: logicalIdx });
        logicalIdx++;
      }
    });

    // If any blocks have displayOrder set, compute the data-order attribute
    const hasCustomOrder = logicalBlocks.some((b) => b.displayOrder !== undefined);
    if (hasCustomOrder) {
      // Sort by displayOrder, keeping undefined at end
      const sorted = [...logicalBlocks].sort((a, b) => {
        const aOrd = a.displayOrder ?? 9999;
        const bOrd = b.displayOrder ?? 9999;
        return aOrd - bOrd;
      });
      const orderArray = sorted.map((b) => b.originalIndex);
      dataAttributes += ` data-order="${orderArray.join(",")}"`;
    }
  } else if (customOrder && customOrder.length > 0) {
    dataAttributes += ` data-order="${customOrder.join(",")}"`;
  }

  // Build explanations map for blocks that have explanations
  const explanationMap: Record<number, string> = {};
  let blockIdx = 0;
  const seenGroupsForExplanations = new Set<string>();
  processedBlocks.forEach((block) => {
    if (block.groupId) {
      if (!seenGroupsForExplanations.has(block.groupId)) {
        seenGroupsForExplanations.add(block.groupId);
        if (block.explanation) {
          explanationMap[blockIdx] = block.explanation;
        }
        blockIdx++;
      }
    } else {
      if (block.explanation) {
        explanationMap[blockIdx] = block.explanation;
      }
      blockIdx++;
    }
  });

  if (Object.keys(explanationMap).length > 0) {
    const escapedJson = JSON.stringify(explanationMap)
      .replace(/&/g, "&amp;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    dataAttributes += ` data-explanations='${escapedJson}'`;
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
