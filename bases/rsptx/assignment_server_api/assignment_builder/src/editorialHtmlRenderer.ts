import { QuestionJSON } from "@/types/exercises";
import { regenerateHtmlSrc } from "@/utils/htmlRegeneration";

export interface EditorialQuestionHtmlInput {
  name: string;
  questionType: string;
  questionJson: QuestionJSON;
  currentHtml: string;
}

export const regenerateEditorialQuestionHtml = ({
  name,
  questionType,
  questionJson,
  currentHtml
}: EditorialQuestionHtmlInput): string =>
  regenerateHtmlSrc(
    {
      name,
      question_type: questionType,
      question_json: JSON.stringify(questionJson),
      htmlsrc: currentHtml
    },
    name
  );

declare global {
  interface Window {
    regenerateEditorialQuestionHtml?: typeof regenerateEditorialQuestionHtml;
  }
}

if (typeof window !== "undefined") {
  window.regenerateEditorialQuestionHtml = regenerateEditorialQuestionHtml;
}
