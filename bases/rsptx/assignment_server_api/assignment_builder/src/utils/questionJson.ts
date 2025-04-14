import { TableDropdownOption } from "@/types/dataset";
import { CreateExerciseFormType, QuestionJSON } from "@/types/exercises";

export const buildQuestionJson = (data: CreateExerciseFormType) => {
  // Create the question JSON object based on question type
  const questionObject = {
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
    }),
    ...(data.question_type === "poll" && {
      statement: data.statement,
      optionList: data.optionList
    }),
    ...(data.question_type === "dragndrop" && {
      statement: data.statement,
      leftColumnBlocks: data.leftColumnBlocks,
      rightColumnBlocks: data.rightColumnBlocks,
      connections: data.connections
    })
  };

  // Ensure we return a JSON string
  return JSON.stringify(questionObject);
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
  ],
  leftColumnBlocks: [{ id: `left-${Date.now()}`, content: "" }],
  rightColumnBlocks: [{ id: `right-${Date.now() + 1}`, content: "" }],
  connections: []
});

export const mergeQuestionJsonWithDefaults = (
  languageOptions: TableDropdownOption[],
  questionJson?: QuestionJSON
): QuestionJSON => {
  const defaultQuestionJson = getDefaultQuestionJson(languageOptions);

  return {
    ...defaultQuestionJson,
    ...questionJson,
    optionList: questionJson?.optionList ?? defaultQuestionJson.optionList,
    statement: questionJson?.statement ?? defaultQuestionJson.statement,
    leftColumnBlocks: questionJson?.leftColumnBlocks ?? defaultQuestionJson.leftColumnBlocks,
    rightColumnBlocks: questionJson?.rightColumnBlocks ?? defaultQuestionJson.rightColumnBlocks,
    connections: questionJson?.connections ?? defaultQuestionJson.connections
  };
};
