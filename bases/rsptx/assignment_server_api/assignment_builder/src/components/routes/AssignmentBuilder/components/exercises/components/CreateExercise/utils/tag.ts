export const addLanguageTag = (
  existingTags: string,
  language: string,
  oldLanguage?: string
): string => {
  if (!language) return existingTags;

  const tagsArray =
    existingTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) || [];

  tagsArray.filter((tag) => tag != oldLanguage);

  if (!tagsArray.includes(language)) {
    tagsArray.push(language);
  }

  return tagsArray.join(",");
};
