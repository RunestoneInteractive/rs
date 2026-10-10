import { parseBlankValues } from "../parseBlankValues";

describe("parseBlankValues", () => {
  it.each([
    ['["first","second"]', ["first", "second"]],
    ["5", ["5"]],
    ["true", ["true"]],
    ['{"value":1}', ["[object Object]"]],
    ["first,second", ["first", "second"]],
    ["", []]
  ])("parses %s", (answer, expected) => {
    expect(parseBlankValues(answer)).toEqual(expected);
  });
});
