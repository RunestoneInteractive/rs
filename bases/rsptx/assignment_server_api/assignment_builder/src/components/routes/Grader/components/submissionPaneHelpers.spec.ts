import { correctChipKind, formatAnswer } from "./submissionPaneHelpers";

describe("formatAnswer", () => {
  it("returns a string answer unchanged", () => {
    expect(formatAnswer("print(42)")).toBe("print(42)");
  });

  it("returns an empty string for null", () => {
    expect(formatAnswer(null)).toBe("");
  });

  it("returns an empty string for undefined", () => {
    expect(formatAnswer(undefined)).toBe("");
  });

  it("serializes an array answer as JSON", () => {
    expect(formatAnswer(["a", "b"])).toBe('["a","b"]');
  });

  it("serializes an object answer as JSON", () => {
    expect(formatAnswer({ choice: "x" })).toBe('{"choice":"x"}');
  });

  it("falls back to String() when JSON serialization throws on a circular value", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(formatAnswer(circular)).toBe("[object Object]");
  });
});

describe("correctChipKind", () => {
  it("returns 'correct' when the attempt is marked correct", () => {
    expect(correctChipKind({ correct: true })).toBe("correct");
  });

  it("returns 'partial' when not correct but percent is above zero", () => {
    expect(correctChipKind({ correct: false, percent: 0.5 })).toBe("partial");
  });

  it("returns 'wrong' when not correct and percent is zero", () => {
    expect(correctChipKind({ correct: false, percent: 0 })).toBe("wrong");
  });

  it("returns 'wrong' when not correct and percent is null", () => {
    expect(correctChipKind({ correct: false, percent: null })).toBe("wrong");
  });

  it("returns null when correctness is null", () => {
    expect(correctChipKind({ correct: null })).toBeNull();
  });

  it("returns null when correctness is undefined", () => {
    expect(correctChipKind({})).toBeNull();
  });

  it("prefers 'correct' over a partial percent when both are present", () => {
    expect(correctChipKind({ correct: true, percent: 0.3 })).toBe("correct");
  });
});
