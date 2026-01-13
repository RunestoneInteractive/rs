import { sanitizeId } from "../sanitize";

export const generateIframePreview = (iframeSrc: string, questionName: string): string => {
  const safeId = sanitizeId(questionName);

  return `
<div class="runestone">
<div data-component="splice" id="${safeId}">
<iframe src="${iframeSrc}" style="width: 100%; height: 400px; border: none;" allowfullscreen></iframe>
</div>
</div>
  `;
};
