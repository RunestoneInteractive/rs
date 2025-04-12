import { Option } from "@/types/createExerciseForm";

export const generateMultiChoicePreview = (
  questionTitle: string,
  options: Option[],
  questionName: string
): string => {
  const optionsHTML = options
    .map((option, index) => {
      const letter = String.fromCharCode(97 + index); // a, b, c, d...
      const correctAttr = option.correct ? "data-correct='yes'" : "";

      return `
    <li 
    data-component="answer" 
    ${correctAttr} id="${questionName}_opt_${letter}">${option.choice}</li><li data-component="feedback">${option.feedback || ""}</li>
    `;
    })
    .join("");

  const multipleAnswers = options.filter((opt) => opt.correct).length > 1 ? "true" : "false";

  return `<div class="runestone ">
    <ul 
     data-component="multiplechoice"
     data-question_label="${questionName}" data-multipleanswers="${multipleAnswers}"  id="${questionName}"  style="visibility: hidden;">
    <p>${questionTitle}</p>
${optionsHTML}
    </ul>
    </div>`;
};
