export const convertDateToISO = (date: Date): string => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 19); // Remove 'Z' and milliseconds
};

export const convertISOStringToDate = (isoString: string): Date => {
  try {
    if (isoString.includes("T")) {
      const [datePart, timePart] = isoString.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes, seconds = 0] = timePart.split(":").map(Number);

      return new Date(year, month - 1, day, hours, minutes, seconds);
    } else {
      return new Date(`${isoString}Z`);
    }
  } catch (e) {
    console.error("Invalid ISO string", isoString);
    return new Date();
  }
};
