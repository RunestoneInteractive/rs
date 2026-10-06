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

  it("returns null when the Parsons source is absent", () => {
    expect(extractParsonsSource("<div>Question only</div>")).toBeNull();
  });
});
