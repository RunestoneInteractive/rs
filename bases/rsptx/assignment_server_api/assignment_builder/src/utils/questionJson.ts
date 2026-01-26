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
      language: data.language,
      stdin: data.stdin,
      selectedExistingDataFiles: data.selectedExistingDataFiles,
      // CodeTailor support
      enableCodeTailor: data.enableCodeTailor,
      parsonspersonalize: data.parsonspersonalize,
      parsonsexample: data.parsonsexample
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
    }),
    ...(data.question_type === "selectquestion" && {
      questionList: data.questionList,
      questionLabels: data.questionLabels,
      abExperimentName: data.abExperimentName,
      toggleOptions: data.toggleOptions,
      dataLimitBasecourse: data.dataLimitBasecourse
    }),
    ...(data.question_type === "clickablearea" && {
      questionText: data.questionText,
      statement: data.statement,
      feedback: data.feedback
    }),
    ...(data.question_type === "iframe" && {
      iframeSrc: data.iframeSrc
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
  stdin: "",
  attachment: false,
  optionList: [
    { choice: "", feedback: "", correct: false },
    { choice: "", feedback: "", correct: false }
  ],
  left: [{ id: "a", label: "" }],
  right: [{ id: "x", label: "" }],
  correctAnswers: [["a", "x"]],
  feedback: "Incorrect. Please try again.",
  blocks: [{ id: `block-${Date.now()}`, content: "", indent: 0 }],
  // CodeTailor support
  enableCodeTailor: false,
  parsonspersonalize: "",
  parsonsexample: ""
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
    instructions: questionJson?.instructions ?? defaultQuestionJson.instructions,
    stdin: questionJson?.stdin ?? defaultQuestionJson.stdin,
    // CodeTailor support
    enableCodeTailor: questionJson?.enableCodeTailor ?? defaultQuestionJson.enableCodeTailor,
    parsonspersonalize:
      questionJson?.parsonspersonalize ??
      (defaultQuestionJson.parsonspersonalize as "" | "solution-level" | "block-and-solution"),
    parsonsexample: questionJson?.parsonsexample ?? defaultQuestionJson.parsonsexample,
    questionLabels: questionJson?.questionLabels ?? {}
  };
};
