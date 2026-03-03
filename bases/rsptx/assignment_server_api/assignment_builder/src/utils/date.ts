/**
 * Converts a local Date object to a UTC ISO string (without 'Z' suffix)
 * for sending to the backend which stores dates in UTC.
 */
export const convertDateToISO = (date: Date): string => {
  return date.toISOString().slice(0, 19); // UTC ISO string without 'Z' and milliseconds
};

/**
 * Converts a local Date object to a local ISO-like string (without timezone info)
 * for sending to the backend which stores due dates in local time (naive datetime).
 * This preserves the original behavior where due dates are stored as-is in the instructor's
 * local timezone without any UTC conversion.
 */
export const convertDateToLocalISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
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
 * Parses a naive date string from the backend as LOCAL time (not UTC).
 * Backend stores due dates in the instructor's local timezone as naive strings
 * (e.g., "2026-02-24T15:00:00"). We parse them without appending 'Z' so
 * JavaScript interprets them as local time.
 */
export const parseLocalDate = (dateString: string): Date => {
  // If the string already has timezone info, parse as-is
  if (dateString.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return new Date(dateString);
  }
  // Parse as local time by NOT appending 'Z'
  return new Date(dateString);
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
 * Formats a local (naive) date string from the backend for display.
 * Since the date is already in local time, no timezone conversion is needed.
 */
export const formatLocalDateForDisplay = (
  localString: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const date = parseLocalDate(localString);
  return date.toLocaleDateString(undefined, options);
};

/**
 * Formats a UTC date string from the backend as a locale string in the user's local timezone.
 */
export const formatUTCDateLocaleString = (utcString: string): string => {
  const date = parseUTCDate(utcString);
  return date.toLocaleString();
};

/**
 * Formats a local (naive) date string from the backend as a locale string.
 * Since the date is already in local time, no timezone conversion is needed.
 */
export const formatLocalDateLocaleString = (localString: string): string => {
  const date = parseLocalDate(localString);
  return date.toLocaleString();
};
