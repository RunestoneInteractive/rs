import { ClickableArea } from "@/components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/components/ClickableAreaExercise/types";
import { sanitizeId } from "../sanitize";

interface ClickableAreaPreviewProps {
  statement: string;
  questionText: string;
  feedback: string;
  clickableAreas: ClickableArea[];
  name: string;
  questionLabel?: string;
}

export const generateClickableAreaPreview = ({
  statement,
  questionText,
  feedback,
  clickableAreas,
  name,
  questionLabel
}: ClickableAreaPreviewProps): string => {
  const safeId = sanitizeId(name, "clickable_" + Date.now());

  const parser = new DOMParser();
  const doc = parser.parseFromString(questionText || "", "text/html");
  const textContent = doc.body.textContent || "";

  const sortedAreas = [...clickableAreas].sort((a, b) => a.startOffset - b.startOffset);

  let result = "";
  let lastIndex = 0;

  sortedAreas.forEach((area) => {
    result += textContent.slice(lastIndex, area.startOffset);
    const dataAttr = area.isCorrect ? "data-correct" : "data-incorrect";
    result += `<span ${dataAttr}="">${area.text}</span>`;
    lastIndex = area.endOffset;
  });

  result += textContent.slice(lastIndex);

  const feedbackHtml = feedback
    ? `<span data-feedback="">
                <div class="para" id="${safeId}-4-1">${feedback}</div>
            </span>`
    : "";

  return `<div class="ptx-runestone-container">
    <div class="runestone clickablearea_section">
        <div data-component="clickablearea" data-question_label="${questionLabel || safeId}" style="visibility: hidden;" id="rs-${safeId}">
            <span data-question="">
                <div class="para" id="${safeId}-2-1">${statement}<div class="autopermalink" data-description="Paragraph"><a
                            href="#${safeId}-2-1" title="Copy heading and permalink for Paragraph"
                            aria-label="Copy heading and permalink for Paragraph">🔗</a></div>
                </div>
            </span>${feedbackHtml}
            <div class="para" id="${safeId}-3-1">${result}<div class="autopermalink"
                    data-description="Paragraph"><a href="#${safeId}-3-1"
                        title="Copy heading and permalink for Paragraph"
                        aria-label="Copy heading and permalink for Paragraph">🔗</a></div>
            </div>
        </div>
    </div>
</div>`;
};
