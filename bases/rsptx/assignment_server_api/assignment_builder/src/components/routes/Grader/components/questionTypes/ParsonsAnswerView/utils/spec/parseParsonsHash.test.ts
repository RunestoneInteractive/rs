import { parseParsonsHash } from "../parseParsonsHash";

describe("parseParsonsHash", () => {
  it("decodes line indexes and the final indentation value", () => {
    expect(parseParsonsHash("0_1_0-2_2")).toEqual([
      { lineIndexes: [0, 1], indent: 0 },
      { lineIndexes: [2], indent: 2 }
    ]);
  });

  it.each(["", "-", null, undefined])("treats %j as an empty answer", (answer) => {
    expect(parseParsonsHash(answer)).toEqual([]);
  });

  it("rejects source code and malformed hashes", () => {
    expect(parseParsonsHash("print('hello')")).toBeNull();
    expect(parseParsonsHash("0_x")).toBeNull();
  });
});
