import { formatAssociationAnswer } from "../../AssociationAnswerView/utils";
import { parseBlankValues } from "../../FitbAnswerView/utils";
import { optionIndexToLabel, parseSelectedOptions } from "../../McqAnswerView/utils";
import { parseParsonsBlocks } from "../../ParsonsAnswerView/utils";

export const formatCompactAnswer = (
  questionType: string,
  answer: string,
  htmlsrc?: string
): string => {
  switch (questionType) {
    case "mchoice":
    case "clickablearea": {
      const selected = parseSelectedOptions(answer);

      return selected.map((option) => `Option ${optionIndexToLabel(option)}`).join(", ");
    }
    case "matching":
    case "dragndrop": {
      const formatted = formatAssociationAnswer(questionType, answer, htmlsrc);

      return formatted || (answer ? "Stored answer could not be decoded." : "");
    }
    case "fillintheblank":
      return parseBlankValues(answer)
        .map((value, index) => `${index + 1}. ${value || "(empty)"}`)
        .join("\n");
    case "parsonsprob":
      return parseParsonsBlocks(answer).join("\n");
    default:
      return answer;
  }
};
