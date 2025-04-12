export const generatePollPreview = (
  questionTitle: string,
  options: string[],
  questionName: string,
  pollType: "options" | "scale" = "options"
): string => {
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
<ul data-component="poll" id="pollid1" data-comment class='' data-results='instructor' data-question_label="${questionName}" >
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
<ul data-component="poll" id="ps-poll-${questionName}" data-comment class='' data-results='preview' data-question_label="${questionName}" >
${questionTitle}
${optionsHTML}
</ul></div>`;
  }
};
