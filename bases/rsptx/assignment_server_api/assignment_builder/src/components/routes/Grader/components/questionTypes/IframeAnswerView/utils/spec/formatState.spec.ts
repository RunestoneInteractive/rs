import { formatState } from "../formatState";

describe("formatState", () => {
  it("formats empty, string, and object saved state", () => {
    expect(formatState(null)).toBe("(no state recorded)");
    expect(formatState("saved")).toBe("saved");
    expect(formatState({ value: 1 })).toBe('{\n  "value": 1\n}');
  });

  it("falls back to string conversion for circular state", () => {
    const circular: Record<string, unknown> = {};

    circular.self = circular;
    expect(formatState(circular)).toBe("[object Object]");
  });
});
