export const getDateFormat = (): string => {
  const lang = navigator.language;

  return lang.startsWith("en") ? "mm/dd/yy" : "dd/mm/yy";
};
