import { Option } from "@/types/createExerciseForm";

export const generateMultiChoicePreview = (
  questionTitle: string,
  options: Option[],
  questionName: string
): string => {
  const optionsHTML = options
    .map((option, index) => {
      const letter = String.fromCharCode(97 + index); // a, b, c, d...
      const correctAttr = option.correct ? "data-correct" : "";

      return `<li data-component="answer" ${correctAttr} id="question1_2_opt_${letter}"><p>${option.choice}</p>
</li><li data-component="feedback" id="question1_2_opt_${letter}">
<p>${option.feedback || ""}</p></li>`;
    })
    .join("");

  const multipleAnswers = options.filter((opt) => opt.correct).length > 1 ? "true" : "false";

  return `
    <div class="runestone ">
        <ul data-component="multiplechoice" data-question_label="${questionName}" data-multipleanswers="${multipleAnswers}"  id="question1_2"  style="visibility: hidden;">
    <p>${questionTitle}</p>
${optionsHTML}
    </ul>
    </div>
    `;
};
