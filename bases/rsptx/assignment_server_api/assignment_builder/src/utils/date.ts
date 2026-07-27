/**
 * Converts a local Date object to a UTC ISO string (without 'Z' suffix)
 * for sending to the backend, which stores every datetime -- duedate,
 * visible_on, hidden_on -- as naive UTC.
 */
export const convertDateToISO = (date: Date): string => {
  return date.toISOString().slice(0, 19); // UTC ISO string without 'Z' and milliseconds
};

export const getDatePickerFormat = (locale = navigator.language) => {
  return locale.endsWith("US") ? "MM/dd/yyyy h:mm aa" : "dd/MM/yyyy HH:mm";
};

/**
 * Parses a UTC date string from the backend into a local Date object.
 * Backend stores dates in UTC as naive strings (e.g., "2026-02-24T15:00:00").
 * We append 'Z' so JavaScript correctly interprets it as UTC.
 */
export const parseUTCDate = (dateString: string): Date => {
  // If the string already ends with 'Z' or has timezone info, parse as-is
  if (dateString.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return new Date(dateString);
  }
  return new Date(dateString + "Z");
};

/**
 * Formats a UTC date string from the backend for display in the user's local timezone.
 */
export const formatUTCDateForDisplay = (
  utcString: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const date = parseUTCDate(utcString);
  return date.toLocaleDateString(undefined, options);
};

/**
 * Formats a UTC date string from the backend as a locale string in the user's local timezone.
 */
export const formatUTCDateLocaleString = (utcString: string): string => {
  const date = parseUTCDate(utcString);
  return date.toLocaleString();
};
