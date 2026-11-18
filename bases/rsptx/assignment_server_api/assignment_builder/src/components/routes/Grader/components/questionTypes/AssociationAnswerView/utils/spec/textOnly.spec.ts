import { textOnly } from "../textOnly";

describe("textOnly", () => {
  it("removes markup and trims text", () => {
    expect(textOnly(" <strong>Loop</strong> ")).toBe("Loop");
  });

  it("returns an empty string for non-string values", () => {
    expect(textOnly(42)).toBe("");
  });
});
