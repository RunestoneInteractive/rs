import { optionIndexToLabel } from "../optionIndexToLabel";

describe("optionIndexToLabel", () => {
  it.each([
    ["0", "A"],
    ["25", "Z"],
    ["26", "AA"],
    ["27", "AB"],
    ["51", "AZ"],
    ["52", "BA"]
  ])("converts option index %s to %s", (index, label) => {
    expect(optionIndexToLabel(index)).toBe(label);
  });

  it("preserves legacy and unsafe option values", () => {
    expect(optionIndexToLabel("legacy-a")).toBe("legacy-a");
    expect(optionIndexToLabel("9007199254740992")).toBe("9007199254740992");
  });
});
