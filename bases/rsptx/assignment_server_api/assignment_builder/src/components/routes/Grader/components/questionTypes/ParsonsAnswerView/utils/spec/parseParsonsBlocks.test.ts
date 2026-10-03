import { parseParsonsBlocks } from "../parseParsonsBlocks";

describe("parseParsonsBlocks", () => {
  it("trims blocks and removes empty separators", () => {
    expect(parseParsonsBlocks(" first - - second - third ")).toEqual(["first", "second", "third"]);
  });

  it("returns an empty list for an empty answer", () => {
    expect(parseParsonsBlocks("")).toEqual([]);
  });
});
