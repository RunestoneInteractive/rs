import { Exercise, QuestionJSON } from "@/types/exercises";
import { generateMultiChoicePreview } from "@/utils/preview/multichoice";
import { generateFillInTheBlankPreview } from "@/utils/preview/fillInTheBlank";
import { generateParsonsPreview } from "@/utils/preview/parsonsPreview";
import { generateActiveCodePreview } from "@/utils/preview/activeCode";
import { generateShortAnswerPreview } from "@/utils/preview/shortAnswer";
import { generateMatchingPreview } from "@/utils/preview/matchingPreview";
import { generateDragAndDropPreview } from "@/utils/preview/dndPreview";
import { generatePollPreview } from "@/utils/preview/poll";
import { safeJsonParse } from "@/utils/json";

/**
 * Regenerates HTML source for a copied exercise with the new name
 * This ensures that IDs and labels in the HTML match the new exercise name
 */
export const regenerateHtmlSrc = (exercise: Exercise, newName: string): string => {
  try {
    console.log(exercise);
    const questionJson: QuestionJSON = exercise.question_json
      ? (safeJsonParse(exercise.question_json) as QuestionJSON)
      : {};

    switch (exercise.question_type) {
      case "mchoice":
        return generateMultiChoicePreview(
          questionJson.statement || "",
          questionJson.optionList || [],
          newName,
          questionJson.forceCheckboxes
        );

      case "fillintheblank":
        return generateFillInTheBlankPreview({
          questionText: questionJson.questionText || "",
          blanks: questionJson.blanks || [],
          name: newName
        });

      case "parsonsprob":
        return generateParsonsPreview({
          instructions: questionJson.instructions || questionJson.questionText || "",
          blocks: questionJson.blocks || [],
          name: newName
        });

      case "activecode":
        console.log(questionJson);
        return generateActiveCodePreview(
          questionJson.instructions || "",
          questionJson.language || "python",
          questionJson.prefix_code || "",
          questionJson.starter_code || "",
          questionJson.suffix_code || "",
          newName,
          questionJson.stdin
        );

      case "shortanswer":
        return generateShortAnswerPreview(
          questionJson.questionText || "",
          questionJson.attachment || false,
          newName
        );

      case "matching":
        return generateMatchingPreview({
          left: questionJson.left || [],
          right: questionJson.right || [],
          correctAnswers: questionJson.correctAnswers || [],
          feedback: questionJson.feedback || "",
          name: newName,
          statement: questionJson.statement || questionJson.questionText || ""
        });

      case "dragndrop":
        return generateDragAndDropPreview({
          left: questionJson.left || [],
          right: questionJson.right || [],
          correctAnswers: questionJson.correctAnswers || [],
          feedback: questionJson.feedback || "",
          name: newName,
          statement: questionJson.statement || questionJson.questionText || ""
        });

      case "poll":
        return generatePollPreview(
          questionJson.questionText || "",
          questionJson.optionList?.map((opt) => opt.choice) || [],
          newName,
          questionJson.poll_type
        );

      default:
        // For unsupported types, try to update the name in the existing HTML
        return updateNameInHtml(exercise.htmlsrc, exercise.name, newName);
    }
  } catch (error) {
    console.error("Error regenerating HTML source:", error);
    return updateNameInHtml(exercise.htmlsrc, exercise.name, newName);
  }
};

/**
 * Fallback method to update question name/ID in existing HTML
 * This is used when we can't regenerate the HTML completely
 */
const updateNameInHtml = (htmlSrc: string, oldName: string, newName: string): string => {
  if (!htmlSrc || !oldName || !newName) {
    return htmlSrc;
  }

  return htmlSrc
    .replace(new RegExp(`id="${oldName}"`, "g"), `id="${newName}"`)
    .replace(new RegExp(`data-component="${oldName}"`, "g"), `data-component="${newName}"`)
    .replace(new RegExp(`data-question="${oldName}"`, "g"), `data-question="${newName}"`)
    .replace(new RegExp(`name="${oldName}"`, "g"), `name="${newName}"`)
    .replace(new RegExp(`name='${oldName}'`, "g"), `name='${newName}'`);
};
