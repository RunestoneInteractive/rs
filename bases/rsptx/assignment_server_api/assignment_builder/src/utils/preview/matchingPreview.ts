interface ItemWithLabel {
  id: string;
  label: string;
}

interface MatchingPreviewProps {
  left: ItemWithLabel[];
  right: ItemWithLabel[];
  correctAnswers: string[][];
  feedback: string;
  name: string;
  statement?: string;
}

const removePTags = (content: string): string => {
  if (!content) return "";

  return content
    .replace(/^<p>/, "")
    .replace(/<\/p>$/, "")
    .replace(/<p>/g, "<span>")
    .replace(/<\/p>/g, "</span>");
};

export const generateMatchingPreview = ({
  left,
  right,
  correctAnswers,
  feedback,
  name,
  statement
}: MatchingPreviewProps): string => {
  const safeId = (name || "exercise_" + Date.now()).replace(/\s+/g, "_").replace(/[^\w]/g, "");

  const jsonData = {
    statement:
      statement || "Match each concept on the left with its correct description on the right.",
    feedback: feedback || "Incorrect. Please try again.",
    left: left.map((item) => ({ id: item.id, label: removePTags(item.label || "") })),
    right: right.map((item) => ({ id: item.id, label: removePTags(item.label || "") })),
    correctAnswers: correctAnswers
  };

  const jsonString = JSON.stringify(jsonData, null, 2);

  return `    
<div class="ptx-runestone-container">
  <div data-component="matching" class="runestone" id="${safeId}">
    <script type="application/json">
      ${jsonString}
    </script>
  </div>
</div>`;
};
