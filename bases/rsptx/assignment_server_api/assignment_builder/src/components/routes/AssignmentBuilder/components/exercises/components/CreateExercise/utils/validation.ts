export const isTipTapContentEmpty = (content: string): boolean => {
  if (!content || !content.trim()) return true;

  // Check for empty paragraph tag patterns
  if (content === "<p></p>" || content === "<p> </p>") return true;

  // Check for YouTube embeds
  if (content.includes("<div data-youtube-video") || content.includes("iframe")) {
    return false;
  }

  // Check for images
  if (content.includes("<img")) {
    return false;
  }

  // Remove all HTML tags and check if there's any content left
  const textContent = content.replace(/<[^>]*>/g, "").trim();

  return textContent === "";
};

export const validateCommonFields = (formData: {
  name?: string;
  chapter?: string;
  subchapter?: string;
  points?: number;
  difficulty?: number;
  statement?: string;
}): string[] => {
  const errors: string[] = [];

  if (!formData.name?.trim()) {
    errors.push("Exercise name is required");
  }
  if (!formData.chapter) {
    errors.push("Chapter is required");
  }
  if (!formData.subchapter) {
    errors.push("Section is required");
  }
  if (formData.points === undefined || formData.points <= 0) {
    errors.push("Points must be greater than 0");
  }
  if (formData.difficulty === undefined) {
    errors.push("Difficulty is required");
  }

  return errors;
};
