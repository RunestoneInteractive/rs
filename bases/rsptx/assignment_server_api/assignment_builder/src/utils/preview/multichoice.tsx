import { Option } from "@/types/createExerciseForm";
import { sanitizeId } from "@/utils/sanitize";

export const generateMultiChoicePreview = (
  questionTitle: string,
  options: Option[],
  questionName: string,
  forceCheckboxes?: boolean
): string => {
  const safeId = sanitizeId(questionName);
  const optionsHTML = options
    .map((option, index) => {
      const letter = String.fromCharCode(97 + index); // a, b, c, d...
      const correctAttr = option.correct ? "data-correct='yes'" : "";

      return `
    <li 
    data-component="answer" 
    ${correctAttr} id="${safeId}_opt_${letter}">${option.choice}</li><li data-component="feedback">${option.feedback || ""}</li>
    `;
    })
    .join("");

  const correctAnswersCount = options.filter((opt) => opt.correct).length;
  const multipleAnswers = forceCheckboxes || correctAnswersCount > 1 ? "true" : "false";

  return `<div class="runestone ">
    <ul 
     data-component="multiplechoice"
     data-question_label="${safeId}" data-multipleanswers="${multipleAnswers}"  id="${safeId}"  style="visibility: hidden;">
    <p>${questionTitle}</p>
${optionsHTML}
    </ul>
    </div>`;
};
