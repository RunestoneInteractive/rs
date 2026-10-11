import { parseJsonObject } from "../parseJsonObject";

describe("parseJsonObject", () => {
  it("accepts JSON objects", () => {
    expect(parseJsonObject('{"value":1}')).toEqual({ value: 1 });
  });

  it.each(["[]", "null", "not-json"])("rejects invalid or non-object JSON: %s", (value) => {
    expect(parseJsonObject(value)).toBeNull();
  });
});
