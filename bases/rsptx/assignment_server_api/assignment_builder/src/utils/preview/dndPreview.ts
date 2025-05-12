import { ItemWithLabel } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/components/DragAndDropExercise/types";

interface DragAndDropPreviewProps {
  left: ItemWithLabel[];
  right: ItemWithLabel[];
  correctAnswers: string[][];
  feedback: string;
  name: string;
  statement?: string;
}

const removePTags = (content: string): string => {
  if (!content) return "";

  return content
    .replace(/^<p>/, "")
    .replace(/<\/p>$/, "")
    .replace(/<p>/g, "<span>")
    .replace(/<\/p>/g, "</span>");
};

export const generateDragAndDropPreview = ({
  left,
  right,
  correctAnswers,
  feedback,
  name,
  statement
}: DragAndDropPreviewProps): string => {
  const safeId = (name || "exercise_" + Date.now()).replace(/\s+/g, "_").replace(/[^\w]/g, "");
  let html = "";

  const usedLeftItems = new Set<string>();
  const connectedRightItems = new Set<string>();

  left.forEach((leftItem) => {
    const connections = correctAnswers.filter(([sourceId]) => sourceId === leftItem.id);

    if (connections.length > 0) {
      connections.forEach(([_, targetId]) => {
        const rightItem = right.find((item) => item.id === targetId);

        if (rightItem) {
          const dragId = `${safeId}_drag_${leftItem.id}`;

          html += `<li data-subcomponent="draggable" id="${dragId}">${removePTags(leftItem.label || "")}</li>`;

          if (!connectedRightItems.has(rightItem.id)) {
            html += `<li data-subcomponent="dropzone" for="${dragId}">${removePTags(rightItem.label || "")}</li>`;
            connectedRightItems.add(rightItem.id);
          }

          usedLeftItems.add(leftItem.id);
        }
      });
    }
  });

  left.forEach((leftItem) => {
    if (!usedLeftItems.has(leftItem.id)) {
      const dragId = `${safeId}_extra_${leftItem.id}`;

      html += `
    <li data-subcomponent="draggable" id="${dragId}">${removePTags(leftItem.label || "")}</li>`;
    }
  });

  const usedRightItems = new Set(correctAnswers.map(([_, targetId]) => targetId));

  right.forEach((rightItem) => {
    if (!usedRightItems.has(rightItem.id)) {
      const placeholderId = `${safeId}_placeholder`;

      html += `
    <li data-subcomponent="dropzone" for="${placeholderId}">${removePTags(rightItem.label || "")}</li>`;
    }
  });

  return `
<div class="runestone flex justify-content-center">
<ul data-component="dragndrop" data-question_label="${safeId}" id="${safeId}" style="visibility: hidden; margin: 0 auto; text-align: center;">
    <span data-subcomponent="question">${removePTags(statement || "Match items from the left column with their corresponding items on the right.")}</span>
    <span data-subcomponent="feedback">${removePTags(feedback || "Incorrect. Please try again.")}</span>
${html}
</ul>   
</div>`;
};
