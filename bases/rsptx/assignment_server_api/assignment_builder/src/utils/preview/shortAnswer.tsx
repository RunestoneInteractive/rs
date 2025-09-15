import { sanitizeId } from "../sanitize";

export const generateShortAnswerPreview = (
  questionTitle: string,
  attachment: boolean,
  questionName: string,
  questionLabel?: string
): string => {
  const safeId = sanitizeId(questionName);

  // Generate HTML based on the provided examples
  return `
<div class="runestone">
<div 
data-component="shortanswer" 
data-question_label="${questionLabel || ""}" class="journal" id=${safeId} ${attachment ? "data-attachment" : ""}>    
${questionTitle}

</div>
</div> <!-- end of runestone div -->
  `;
};
