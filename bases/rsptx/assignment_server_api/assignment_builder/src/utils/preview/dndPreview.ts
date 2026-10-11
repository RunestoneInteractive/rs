import { ItemWithLabel } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/components/DragAndDropExercise/types";

import { DEFAULT_INCORRECT_FEEDBACK } from "@/utils/questionJson";

import { sanitizeId } from "../sanitize";

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

/*
 * The data-subcomponent markup has no place for feedback on an individual card,
 * so a question with any (e.g. a PreTeXt cardsort stored from a book) is written
 * as a JSON script block instead, which the dragndrop component also reads.
 * Item ids become element ids, so prefix them to keep them unique on a page.
 */
const generateDragAndDropJson = ({
  left,
  right,
  correctAnswers,
  feedback,
  statement,
  safeId
}: Omit<DragAndDropPreviewProps, "name"> & { safeId: string }): string => {
  const scopedId = (id: string): string => `${safeId}_${id}`;
  const toItem = (item: ItemWithLabel) => ({
    id: scopedId(item.id),
    label: removePTags(item.label || ""),
    ...(item.feedback && { feedback: item.feedback })
  });
  const jsonData = {
    statement:
      statement || "Match items from the left column with their corresponding items on the right.",
    feedback: feedback || DEFAULT_INCORRECT_FEEDBACK,
    left: left.map(toItem),
    right: right.map(toItem),
    correctAnswers: correctAnswers.map(([leftId, rightId]) => [scopedId(leftId), scopedId(rightId)])
  };

  // "</" would end the script element early.
  const jsonString = JSON.stringify(jsonData, null, 2).replace(/<\//g, "<\\/");

  return `
<div class="runestone flex justify-content-center">
<div data-component="dragndrop" data-question_label="${safeId}" id="${safeId}">
  <script type="application/json">
${jsonString}
  </script>
</div>
</div>`;
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

  if ([...left, ...right].some((item) => item.feedback)) {
    return generateDragAndDropJson({ left, right, correctAnswers, feedback, statement, safeId });
  }

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
