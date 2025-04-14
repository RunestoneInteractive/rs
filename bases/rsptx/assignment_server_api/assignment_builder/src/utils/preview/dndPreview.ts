import {
  DragBlock,
  BlockConnection
} from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/components/DragAndDropExercise/types";

interface DragAndDropPreviewProps {
  leftColumnBlocks: DragBlock[];
  rightColumnBlocks: DragBlock[];
  connections: BlockConnection[];
  name: string;
  statement?: string;
}

export const generateDragAndDropPreview = ({
  leftColumnBlocks,
  rightColumnBlocks,
  connections,
  name,
  statement
}: DragAndDropPreviewProps): string => {
  const safeId = name.replace(/\s+/g, "_").replace(/[^\w]/g, "");

  let dragAndDropItems = "";
  let itemIndex = 0;

  connections.forEach((connection) => {
    const leftBlock = leftColumnBlocks.find((block) => block.id === connection.sourceId);
    const rightBlock = rightColumnBlocks.find((block) => block.id === connection.targetId);

    if (leftBlock && rightBlock) {
      itemIndex++;
      const dragId = `${safeId}_drag${itemIndex}`;

      dragAndDropItems += `
    <li data-subcomponent="draggable" id="${dragId}">${leftBlock.content}</li>
    <li data-subcomponent="dropzone" for="${dragId}">${rightBlock.content}</li>`;
    }
  });

  const usedLeftBlockIds = connections.map((conn) => conn.sourceId);
  const usedRightBlockIds = connections.map((conn) => conn.targetId);

  leftColumnBlocks.forEach((block) => {
    if (!usedLeftBlockIds.includes(block.id)) {
      itemIndex++;
      const dragId = `${safeId}_drag${itemIndex}`;

      dragAndDropItems += `
    <li data-subcomponent="draggable" id="${dragId}">${block.content}</li>`;
    }
  });

  rightColumnBlocks.forEach((block) => {
    if (!usedRightBlockIds.includes(block.id)) {
      itemIndex++;
      const dragId = `${safeId}_drop${itemIndex}`;

      dragAndDropItems += `
    <li data-subcomponent="dropzone" for="${dragId}">${block.content}</li>`;
    }
  });

  return `
<div class="runestone flex justify-content-center">
<ul data-component="dragndrop" data-question_label="${safeId}" id="${safeId}" style="visibility: hidden; margin: 0 auto; text-align: center;">
    <span data-subcomponent="question">${statement || "Match items from the left column with their corresponding items on the right."}</span>
${dragAndDropItems}
</ul>
</div>`;
};
