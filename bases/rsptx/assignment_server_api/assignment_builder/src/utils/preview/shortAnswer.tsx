export const generateShortAnswerPreview = (
  questionTitle: string,
  attachment: boolean,
  questionName: string,
  questionLabel?: string
): string => {
  // Create a unique ID for the exercise
  const uniqueId = questionName.replace(/\s+/g, "");

  // Generate HTML based on the provided examples
  return `
<div class="runestone">
<div 
data-component="shortanswer" 
data-question_label="${questionLabel || ""}" class="journal" id=${uniqueId} ${attachment ? "data-attachment" : ""}>    
${questionTitle}

</div>
</div> <!-- end of runestone div -->
  `;
};
