export const textOnly = (value: unknown): string => {
  if (typeof value !== "string") return "";

  const element = document.createElement("div");

  element.innerHTML = value;
  return element.textContent?.trim() || value.trim();
};
