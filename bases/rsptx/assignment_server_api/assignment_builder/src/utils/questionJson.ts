import { TableDropdownOption } from "@/types/dataset";
import { CreateExerciseFormType, QuestionJSON } from "@/types/exercises";

export const buildQuestionJson = (data: CreateExerciseFormType) => {
  return JSON.stringify({
    ...(data.question_type === "activecode" && {
      prefix_code: data.prefix_code,
      starter_code: data.starter_code,
      suffix_code: data.suffix_code,
      instructions: data.instructions,
      language: data.language
    }),
    ...(data.question_type === "shortanswer" && {
      attachment: data.attachment,
      statement: data.statement
    }),
    ...(data.question_type === "mchoice" && {
      statement: data.statement,
      optionList: data.optionList
    })
  });
};

export const getDefaultQuestionJson = (languageOptions: TableDropdownOption[]) => ({
  statement: "",
  language: languageOptions && languageOptions[0].value,
  instructions: "",
  prefix_code: "",
  starter_code: "",
  suffix_code: "",
  attachment: false,
  optionList: [
    { choice: "", feedback: "", correct: false },
    { choice: "", feedback: "", correct: false }
  ]
});

export const mergeQuestionJsonWithDefaults = (
  languageOptions: TableDropdownOption[],
  questionJson?: QuestionJSON
): QuestionJSON => {
  const defaultQuestionJson = getDefaultQuestionJson(languageOptions);

  return {
    ...defaultQuestionJson,
    ...questionJson,
    optionList: questionJson?.optionList ?? defaultQuestionJson.optionList
  };
};
