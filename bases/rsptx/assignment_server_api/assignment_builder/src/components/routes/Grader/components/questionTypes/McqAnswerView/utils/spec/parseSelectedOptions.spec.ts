import { parseSelectedOptions } from "../parseSelectedOptions";

describe("parseSelectedOptions", () => {
  it("splits selected options and removes empty segments", () => {
    expect(parseSelectedOptions("0,,2")).toEqual(["0", "2"]);
    expect(parseSelectedOptions("")).toEqual([]);
  });
});
