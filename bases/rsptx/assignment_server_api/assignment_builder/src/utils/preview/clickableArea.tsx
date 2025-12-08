import { sanitizeId } from "../sanitize";

export const generateClickableAreaPreview = (
  content: string,
  questionName: string,
  feedback?: string,
  statement?: string
): string => {
  const safeId = sanitizeId(questionName);

  // TipTap now generates data-correct="" and data-incorrect="" directly, so minimal processing needed
  let processedContent = content;

  // Remove wrapping <p> tags if present (TipTap adds them)
  processedContent = processedContent.replace(/^<p>(.*)<\/p>$/s, "$1").trim();

  return `
<div class="ptx-runestone-container">
  <div class="runestone clickablearea_section">
    <div data-component="clickablearea" data-question_label="${safeId || ""}" style="visibility: hidden;" id="${safeId}">
      <span data-question="">
        <div class="para" id="${safeId}-question">${statement || ""}<div class="autopermalink" data-description="Paragraph"><a href="#${safeId}-question" title="Copy heading and permalink for Paragraph" aria-label="Copy heading and permalink for Paragraph">🔗</a></div></div>
      </span><span data-feedback="">
        <div class="para" id="${safeId}-feedback">${feedback || ""}</div>
      </span>
      <div class="para" id="${safeId}-content">${processedContent}<div class="autopermalink" data-description="Paragraph"><a href="#${safeId}-content" title="Copy heading and permalink for Paragraph" aria-label="Copy heading and permalink for Paragraph">🔗</a></div></div>
    </div>
  </div>
</div>
  `;
};
