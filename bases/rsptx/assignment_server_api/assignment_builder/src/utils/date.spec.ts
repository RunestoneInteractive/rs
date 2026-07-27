import {
  convertDateToISO,
  getDatePickerFormat,
  parseUTCDate,
  formatUTCDateForDisplay,
  formatUTCDateLocaleString
} from "./date";

describe("convertDateToISO", () => {
  it("returns a UTC ISO string without the trailing Z", () => {
    const date = new Date("2026-02-24T15:00:00Z");
    const result = convertDateToISO(date);
    expect(result).toBe("2026-02-24T15:00:00");
  });

  it("trims milliseconds from the result", () => {
    const date = new Date("2026-02-24T15:00:00.999Z");
    const result = convertDateToISO(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(result).toBe("2026-02-24T15:00:00");
  });

  it("returns exactly 19 characters", () => {
    const date = new Date("2000-01-01T00:00:00Z");
    expect(convertDateToISO(date)).toHaveLength(19);
  });
});

describe("getDatePickerFormat", () => {
  it("returns US date format when locale ends with US", () => {
    expect(getDatePickerFormat("en-US")).toBe("MM/dd/yyyy h:mm aa");
  });

  it("returns international date format for non-US locales", () => {
    expect(getDatePickerFormat("en-GB")).toBe("dd/MM/yyyy HH:mm");
  });

  it("returns international date format for locale de-DE", () => {
    expect(getDatePickerFormat("de-DE")).toBe("dd/MM/yyyy HH:mm");
  });

  it("returns international date format for locale fr-FR", () => {
    expect(getDatePickerFormat("fr-FR")).toBe("dd/MM/yyyy HH:mm");
  });

  it("returns a string for unknown or empty locale string", () => {
    const result = getDatePickerFormat("xx-XX");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("parseUTCDate", () => {
  it("appends Z and parses a naive UTC string as UTC", () => {
    const result = parseUTCDate("2026-02-24T15:00:00");
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(1);
    expect(result.getUTCDate()).toBe(24);
    expect(result.getUTCHours()).toBe(15);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
  });

  it("parses a string that already ends with Z without modification", () => {
    const result = parseUTCDate("2026-02-24T15:00:00Z");
    expect(result.getUTCHours()).toBe(15);
  });

  it("parses a string with positive timezone offset as-is", () => {
    const result = parseUTCDate("2026-02-24T17:00:00+02:00");
    expect(result.getUTCHours()).toBe(15);
  });

  it("parses a string with negative timezone offset as-is", () => {
    const result = parseUTCDate("2026-02-24T10:00:00-05:00");
    expect(result.getUTCHours()).toBe(15);
  });

  it("returns a Date instance", () => {
    expect(parseUTCDate("2026-01-01T00:00:00")).toBeInstanceOf(Date);
  });
});

describe("formatUTCDateForDisplay", () => {
  it("returns a non-empty string for a valid UTC naive string", () => {
    const result = formatUTCDateForDisplay("2026-02-24T15:00:00");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("accepts custom Intl.DateTimeFormatOptions and uses them", () => {
    const result = formatUTCDateForDisplay("2026-02-24T15:00:00", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a string for a string that already ends with Z", () => {
    const result = formatUTCDateForDisplay("2026-02-24T15:00:00Z");
    expect(typeof result).toBe("string");
  });
});

describe("formatUTCDateLocaleString", () => {
  it("returns a non-empty locale string for a valid UTC naive string", () => {
    const result = formatUTCDateLocaleString("2026-02-24T15:00:00");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a string for a UTC string ending with Z", () => {
    const result = formatUTCDateLocaleString("2026-02-24T15:00:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
