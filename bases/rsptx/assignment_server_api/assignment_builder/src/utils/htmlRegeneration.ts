import { Exercise, QuestionJSON } from "@/types/exercises";
import { safeJsonParse } from "@/utils/json";
import {
  generateActiveCodePreview,
  pickActiveCodeAdvancedOptions
} from "@/utils/preview/activeCode";
import { generateClickableAreaPreview } from "@/utils/preview/clickableArea";
import { generateDragAndDropPreview } from "@/utils/preview/dndPreview";
import { generateFillInTheBlankPreview } from "@/utils/preview/fillInTheBlank";
import { generateIframePreview } from "@/utils/preview/iframePreview";
import { generateMatchingPreview } from "@/utils/preview/matchingPreview";
import { generateMultiChoicePreview } from "@/utils/preview/multichoice";
import { generateParsonsPreview } from "@/utils/preview/parsonsPreview";
import { generatePollPreview } from "@/utils/preview/poll";
import { generateSelectQuestionPreview } from "@/utils/preview/selectQuestionPreview";
import { generateShortAnswerPreview } from "@/utils/preview/shortAnswer";

type HtmlRegenerationExercise = Pick<
  Exercise,
  "htmlsrc" | "name" | "question_json" | "question_type"
>;

/**
 * Regenerates HTML source for a copied exercise with the new name
 * This ensures that IDs and labels in the HTML match the new exercise name
 */
export const regenerateHtmlSrc = (exercise: HtmlRegenerationExercise, newName: string): string => {
  try {
    const questionJson: QuestionJSON = exercise.question_json
      ? (safeJsonParse(exercise.question_json) as QuestionJSON)
      : {};

    switch (exercise.question_type) {
      case "mchoice":
        return generateMultiChoicePreview(
          questionJson.statement || "",
          questionJson.optionList || [],
          newName,
          questionJson.forceCheckboxes,
          questionJson.random
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
          name: newName,
          language: questionJson.language || "python",
          adaptive: questionJson.adaptive ?? true,
          numbered: questionJson.numbered ?? "left",
          noindent: questionJson.noindent ?? false,
          questionLabel: newName,
          grader: questionJson.grader,
          orderMode: questionJson.orderMode,
          customOrder: questionJson.customOrder,
          runnable: questionJson.runnable,
          runnableCode: questionJson.runnableCode,
          runnableOptions: questionJson.runnableOptions
        });

      case "activecode":
        return generateActiveCodePreview(
          questionJson.instructions || "",
          questionJson.language || "python",
          questionJson.prefix_code || "",
          questionJson.starter_code || "",
          questionJson.suffix_code || "",
          newName,
          questionJson.stdin,
          (questionJson.selectedExistingDataFiles || []).map((acid) => ({ acid })),
          {
            enableCodeTailor: questionJson.enableCodeTailor,
            parsonspersonalize: questionJson.parsonspersonalize,
            parsonsexample: questionJson.parsonsexample,
            parsonsPersonalized: questionJson.parsonsPersonalized,
            enableCodelens: questionJson.enableCodelens
          },
          pickActiveCodeAdvancedOptions(questionJson)
        );

      case "shortanswer":
        return generateShortAnswerPreview(
          questionJson.statement || questionJson.questionText || "",
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
          questionJson.statement || questionJson.questionText || "",
          questionJson.optionList?.map((opt) => opt.choice) || [],
          newName,
          questionJson.poll_type,
          questionJson.results
        );

      case "iframe":
        return generateIframePreview(questionJson.iframeSrc || "", newName);

      case "clickablearea":
        return generateClickableAreaPreview(
          questionJson.questionText || "",
          newName,
          questionJson.feedback || "",
          questionJson.statement || ""
        );

      case "selectquestion":
        return generateSelectQuestionPreview({
          name: newName,
          questionList: (questionJson.questionList || []).map((questionId) => ({
            questionId,
            label: questionJson.questionLabels?.[questionId]
          })),
          abExperimentName: questionJson.abExperimentName,
          toggleOptions: questionJson.toggleOptions,
          dataLimitBasecourse: questionJson.dataLimitBasecourse
        });

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
