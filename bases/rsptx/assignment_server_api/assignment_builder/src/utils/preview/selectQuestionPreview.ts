import { QuestionWithLabel } from "@/types/exercises";

interface SelectQuestionPreviewWithLabelsProps {
  name: string;
  questionList: QuestionWithLabel[];
  abExperimentName?: string;
  toggleOptions?: string[];
  dataLimitBasecourse?: boolean;
}

interface SelectQuestionPreviewWithStringsProps {
  name: string;
  questionList: string[];
  abExperimentName?: string;
  toggleOptions?: string[];
  dataLimitBasecourse?: boolean;
}

type SelectQuestionPreviewProps =
  | SelectQuestionPreviewWithLabelsProps
  | SelectQuestionPreviewWithStringsProps;

export const generateSelectQuestionPreview = ({
  name,
  questionList,
  abExperimentName,
  toggleOptions,
  dataLimitBasecourse
}: SelectQuestionPreviewProps): string => {
  const safeId = (name || `selectquestion_${Date.now()}`).replace(/\s+/g, "_").replace(/\W/g, "");

  const questions: QuestionWithLabel[] = Array.isArray(questionList)
    ? questionList.map((item) => (typeof item === "string" ? { questionId: item } : item))
    : [];

  let html = "<div class=\"runestone sqcontainer %(optclass)s\"><div data-component=\"selectquestion\"";

  html += ` id=${safeId}`;

  const questionListStr = questions.map((q) => q.questionId).join(", ");

  html += ` data-questionlist='${questionListStr}'`;

  if (abExperimentName) {
    html += ` data-ab="${abExperimentName}"`;
  }

  if (toggleOptions && toggleOptions.length > 0) {
    const toggleStr = toggleOptions.join(", ");

    html += ` data-toggleoptions="${toggleStr}"`;
  }

  const questionLabels = questions
    .filter((q) => q.label)
    .map((q) => `${q.questionId}:${q.label}`)
    .join(",");

  if (questionLabels) {
    html += ` data-togglelabels="${questionLabels}"`;
  }

  if (dataLimitBasecourse) {
    html += " data-limit-basecourse=true";
  }

  const questionListDisplay = questions
    .map((q) => (q.label ? `${q.questionId} (${q.label})` : q.questionId))
    .join(", ");

  html += `>    <p>Loading a dynamic question ...<br/>Selecting from: ${questionListDisplay}</p></div></div>`;

  return html;
};
