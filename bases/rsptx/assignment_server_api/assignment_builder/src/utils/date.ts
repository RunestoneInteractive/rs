export const convertDateToISO = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 19); // Remove 'Z' and milliseconds
};

export const getDateFormat = (locale = navigator.language) => {
  return locale.endsWith("US") ? "mm/dd/yy" : "dd/mm/yy";
};
