import {
  BlankWithFeedback,
  GraderType
} from "@/components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/components/FillInTheBlankExercise/types";

const escapeJsonString = (str: string): string => {
  return str.replace(/"/g, '\\"');
};

interface FillInTheBlankPreviewProps {
  questionText: string;
  blanks: BlankWithFeedback[];
  name: string;
  questionLabel?: string;
}

export const generateFillInTheBlankPreview = ({
  questionText,
  blanks,
  name,
  questionLabel
}: FillInTheBlankPreviewProps): string => {
  const safeId = (name || "fitb_" + Date.now()).replace(/\s+/g, "_").replace(/[^\w]/g, "");

  const blankNames = blanks.reduce(
    (acc, _, index) => {
      acc.x = Math.max(acc.x || 0, index);
      return acc;
    },
    {} as Record<string, number>
  );

  const feedbackArray = blanks.map((blank) => {
    const feedbackItems = [];

    if (blank.graderType === GraderType.NUMBER) {
      if (blank.numberMin !== undefined && blank.numberMax !== undefined) {
        feedbackItems.push({
          number: [parseFloat(blank.numberMin), parseFloat(blank.numberMax)],
          feedback: `<p>${escapeJsonString(blank.correctFeedback || "Correct!")}</p>\n`
        });
      }
    } else if (blank.graderType === GraderType.REGEX) {
      if (blank.regexPattern) {
        feedbackItems.push({
          regex: `^\\s*${blank.regexPattern}\\s*$`,
          regexFlags: blank.regexFlags || "",
          feedback: `<p>${escapeJsonString(blank.correctFeedback || "Correct!")}</p>\n`
        });
      }
    } else {
      if (blank.exactMatch) {
        feedbackItems.push({
          regex: `^\\s*${escapeJsonString(blank.exactMatch)}\\s*$`,
          regexFlags: "",
          feedback: `<p>${escapeJsonString(blank.correctFeedback || "Correct!")}</p>\n`
        });
      }
    }

    feedbackItems.push({
      regex: "^\\s*.*\\s*$",
      regexFlags: "",
      feedback: `<p>${escapeJsonString(blank.incorrectFeedback || "Incorrect, please try again.")}</p>\n`
    });

    return feedbackItems;
  });

  const problemHtml = `<p>${questionText.replace(/{blank}/g, '<input type="text" name="x" />')}</p>\n`;

  const jsonData = {
    problemHtml,
    dyn_vars: null,
    blankNames,
    feedbackArray
  };

  const jsonString = JSON.stringify(jsonData);

  return `
<div class="runestone">
  <div data-component="fillintheblank" data-question_label="${questionLabel || ""}" id="${safeId}" style="visibility: hidden;">
    <script type="application/json">
      ${jsonString}
    </script>
  </div>
</div>`;
};
