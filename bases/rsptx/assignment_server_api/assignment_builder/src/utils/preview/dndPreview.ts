import { ItemWithLabel } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/components/DragAndDropExercise/types";
import { sanitizeId } from "../sanitize";

import { DEFAULT_INCORRECT_FEEDBACK } from "@/utils/questionJson";

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
  const safeId = sanitizeId(name, "exercise_" + Date.now());
  let html = "";

  const usedLeftItems = new Set<string>();
  const connectedRightItems = new Set<string>();

  // The dragndrop component decides whether a premise was dropped in the right
  // place by comparing its data-category with the dropzone's. Deriving the
  // category from the dropzone's `for` attribute (the old behaviour) can only
  // express one premise per dropzone, so the second and later premises that
  // belong in the same dropzone were graded as misplaced. Give every premise
  // and its dropzone the same explicit category instead.
  const categoryFor = (rightId: string): string => `${safeId}_cat_${rightId}`;

  left.forEach((leftItem) => {
    const connections = correctAnswers.filter(([sourceId]) => sourceId === leftItem.id);

    if (connections.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      connections.forEach(([_, targetId]) => {
        const rightItem = right.find((item) => item.id === targetId);

        if (rightItem) {
          const dragId = `${safeId}_drag_${leftItem.id}`;
          const category = categoryFor(rightItem.id);

          // A premise lives in exactly one dropzone, so emit it only once even
          // if the author linked it to several -- duplicate ids would break the
          // component.
          if (!usedLeftItems.has(leftItem.id)) {
            html += `<li data-subcomponent="draggable" id="${dragId}" data-category="${category}">${removePTags(leftItem.label || "")}</li>`;
          }

          if (!connectedRightItems.has(rightItem.id)) {
            html += `<li data-subcomponent="dropzone" for="${dragId}" data-category="${category}">${removePTags(rightItem.label || "")}</li>`;
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const usedRightItems = new Set(correctAnswers.map(([_, targetId]) => targetId));

  right.forEach((rightItem) => {
    if (!usedRightItems.has(rightItem.id)) {
      // The `for` value becomes the dropzone's element id, so it has to be
      // unique across every dropzone with no premises of its own.
      const placeholderId = `${safeId}_placeholder_${rightItem.id}`;

      html += `
    <li data-subcomponent="dropzone" for="${placeholderId}" data-category="${categoryFor(rightItem.id)}">${removePTags(rightItem.label || "")}</li>`;
    }
  });

  return `
<div class="runestone flex justify-content-center">
<ul data-component="dragndrop" data-question_label="${safeId}" id="${safeId}" style="visibility: hidden; margin: 0 auto; text-align: center;">
    <span data-subcomponent="question">${removePTags(statement || "Match items from the left column with their corresponding items on the right.")}</span>
    <span data-subcomponent="feedback">${removePTags(feedback || DEFAULT_INCORRECT_FEEDBACK)}</span>
${html}
</ul>   
</div>`;
};
