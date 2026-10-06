import { formatAssociationAnswer } from "../../AssociationAnswerView/utils";
import { parseBlankValues } from "../../FitbAnswerView/utils";
import { optionIndexToLabel, parseSelectedOptions } from "../../McqAnswerView/utils";
import { reconstructParsonsAnswer } from "../../ParsonsAnswerView/utils";

export const formatCompactAnswer = (
  questionType: string,
  answer?: string | null,
  htmlsrc?: string
): string => {
  const normalizedAnswer = answer ?? "";

  switch (questionType) {
    case "mchoice":
    case "clickablearea": {
      const selected = parseSelectedOptions(normalizedAnswer);

      return selected.map((option) => `Option ${optionIndexToLabel(option)}`).join(", ");
    }
    case "matching":
    case "dragndrop": {
      const formatted = formatAssociationAnswer(questionType, normalizedAnswer, htmlsrc);

      return formatted || (normalizedAnswer ? "Stored answer could not be decoded." : "");
    }
    case "fillintheblank":
      return parseBlankValues(normalizedAnswer)
        .map((value, index) => `${index + 1}. ${value || "(empty)"}`)
        .join("\n");
    case "parsonsprob":
      return (
        reconstructParsonsAnswer(normalizedAnswer, htmlsrc) ??
        "Stored answer could not be reconstructed."
      );
    default:
      return normalizedAnswer;
  }
};
