import { PollResults } from "@/types/exercises";
import { sanitizeId } from "@/utils/sanitize";

export const generatePollPreview = (
  questionTitle: string,
  options: string[],
  questionName: string,
  pollType: string = "options",
  results: PollResults = "instructor"
): string => {
  const safeId = sanitizeId(questionName);
  // Function to strip paragraph tags and clean HTML
  const stripParagraphTags = (html: string): string => {
    // Replace opening and closing paragraph tags
    return html.replace(/<p>/g, "").replace(/<\/p>/g, "").trim();
  };

  // Generate poll HTML directly to match the examples
  if (pollType === "scale") {
    // Scale poll type
    const optionsHTML = options
      .map((option) => `\n<li>${stripParagraphTags(option)}</li>\n`)
      .join("\n");

    return `
<div class="runestone ">
<ul data-component="poll" id="${safeId}" data-comment class='' data-results='${results}' data-question_label="${safeId}" >
 ${questionTitle}
${optionsHTML}
</ul></div>`;
  } else {
    // Options poll type
    const optionsHTML = options
      .map((option, index) => {
        const cleanOption = stripParagraphTags(option);

        return `<li style="white-space: nowrap;">${index + 1}.&nbsp;${cleanOption}</li>`;
      })
      .join("\n");

    return `
<div class="runestone ">
<ul data-component="poll" id="${safeId}" data-comment class='' data-results='${results}' data-question_label="${safeId}" >
${questionTitle}
${optionsHTML}
</ul></div>`;
  }
};
