export const convertDateToISO = (date: Date): string => {
  return date.toISOString().replace("Z", "");
};

export const convertISOStringToDate = (isoString: string): Date => {
  try {
    return new Date(`${isoString}Z`);
  } catch (e) {
    console.error("Invalid ISO string", isoString);
    return new Date();
  }
};
