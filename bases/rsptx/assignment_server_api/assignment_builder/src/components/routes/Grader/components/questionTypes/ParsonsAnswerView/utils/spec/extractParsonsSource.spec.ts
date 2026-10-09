import { extractParsonsSource } from "../extractParsonsSource";

describe("extractParsonsSource", () => {
  it("extracts decoded lines, indentation levels, and removes Parsons metadata", () => {
    const htmlsrc = `<pre class="parsonsblocks">
if left &lt; right:
---
    print(left) #distractor: not needed
---
        return left
    </pre>`;

    expect(extractParsonsSource(htmlsrc)).toEqual({
      indentUnit: "    ",
      lines: [
        { indentLevel: 0, text: "if left < right:" },
        { indentLevel: 1, text: "print(left)" },
        { indentLevel: 2, text: "return left" }
      ],
      noIndent: false
    });
  });

  it("recognizes questions where indentation cannot be changed", () => {
    expect(
      extractParsonsSource('<pre class="parsonsblocks" data-noindent="true">a\n---\n  b</pre>')
    ).toMatchObject({ indentUnit: "  ", noIndent: true });
  });

  it.each([
    ["line #paired:alternative", "line"],
    ["line #tag:condition;depends:setup;", "line"]
  ])("removes supported block metadata from %j", (block, expected) => {
    expect(extractParsonsSource(`<pre class="parsonsblocks">${block}</pre>`)).toMatchObject({
      lines: [{ indentLevel: 0, text: expected }]
    });
  });

  it("parses line-based sources without block separators", () => {
    expect(extractParsonsSource('<pre class="parsonsblocks">first\n  second</pre>')).toMatchObject({
      indentUnit: "  ",
      lines: [
        { indentLevel: 0, text: "first" },
        { indentLevel: 1, text: "second" }
      ]
    });
  });

  it("uses the default indentation when the source has no indented lines", () => {
    expect(extractParsonsSource('<pre class="parsonsblocks">first\nsecond</pre>')).toMatchObject({
      indentUnit: "    "
    });
  });

  it("recognizes tabs as the indentation unit", () => {
    expect(
      extractParsonsSource('<pre class="parsonsblocks">first\n---\n\tsecond</pre>')
    ).toMatchObject({
      indentUnit: "\t"
    });
  });

  it.each([undefined, "", "<div>Question only</div>"])(
    "returns null when the Parsons source is absent from %j",
    (source) => {
      expect(extractParsonsSource(source)).toBeNull();
    }
  );
});
