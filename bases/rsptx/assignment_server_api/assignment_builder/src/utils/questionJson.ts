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
      left: data.left,
      right: data.right,
      correctAnswers: data.correctAnswers,
      feedback: data.feedback
    }),
    ...(data.question_type === "matching" && {
      statement: data.statement,
      left: data.left,
      right: data.right,
      correctAnswers: data.correctAnswers,
      feedback: data.feedback
    }),
    ...(data.question_type === "parsonsprob" && {
      blocks: data.blocks,
      language: data.language,
      instructions: data.instructions
    }),
    ...(data.question_type === "fillintheblank" && {
      questionText: data.questionText,
      blanks: data.blanks
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
  left: [{ id: "a", label: "" }],
  right: [{ id: "x", label: "" }],
  correctAnswers: [["a", "x"]],
  feedback: "Incorrect. Please try again.",
  blocks: [{ id: `block-${Date.now()}`, content: "", indent: 0 }]
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
    left: questionJson?.left ?? defaultQuestionJson.left,
    right: questionJson?.right ?? defaultQuestionJson.right,
    correctAnswers: questionJson?.correctAnswers ?? defaultQuestionJson.correctAnswers,
    feedback: questionJson?.feedback ?? defaultQuestionJson.feedback,
    blocks: questionJson?.blocks ?? defaultQuestionJson.blocks,
    language: questionJson?.language ?? defaultQuestionJson.language,
    instructions: questionJson?.instructions ?? defaultQuestionJson.instructions
  };
};
