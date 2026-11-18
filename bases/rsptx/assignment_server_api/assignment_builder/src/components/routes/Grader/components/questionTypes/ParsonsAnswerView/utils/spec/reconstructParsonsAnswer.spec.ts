import { reconstructParsonsAnswer } from "../reconstructParsonsAnswer";

const htmlsrc = `<div data-component="parsons">
  <pre class="parsonsblocks">
def greet(name):
---
    if name:
---
        print(f"Hello, {name}")
  </pre>
</div>`;

describe("reconstructParsonsAnswer", () => {
  it("reconstructs the submitted order and indentation", () => {
    expect(reconstructParsonsAnswer("0_0-1_1-2_2", htmlsrc)).toBe(
      'def greet(name):\n    if name:\n        print(f"Hello, {name}")'
    );
  });

  it("preserves an incorrect student order", () => {
    expect(reconstructParsonsAnswer("2_0-0_1-1_2", htmlsrc)).toBe(
      'print(f"Hello, {name}")\n    def greet(name):\n        if name:'
    );
  });

  it("preserves relative indentation inside a multi-line block", () => {
    expect(reconstructParsonsAnswer("0_1_2", htmlsrc)).toBe(
      "        def greet(name):\n            if name:"
    );
  });

  it("preserves source indentation when indentation changes are disabled", () => {
    const noIndentSource =
      '<pre class="parsonsblocks" data-noindent="true">first\n---\n  second</pre>';

    expect(reconstructParsonsAnswer("0_4-1_0", noIndentSource)).toBe("first\n  second");
  });

  it("preserves blank lines inside a multi-line block", () => {
    const sourceWithBlankLine = `<pre class="parsonsblocks">
if ready:
---
    start()

    finish()
    </pre>`;

    expect(reconstructParsonsAnswer("0_1_2_3_0", sourceWithBlankLine)).toBe(
      "if ready:\n    start()\n\n    finish()"
    );
  });

  it("formats legacy plain-text answers without block separators", () => {
    expect(reconstructParsonsAnswer("def greet(name):\n---\n    if name:")).toBe(
      "def greet(name):\n    if name:"
    );
  });

  it("normalizes legacy line endings and padded block separators", () => {
    expect(reconstructParsonsAnswer("first\r\n \t--- \r\n  second\r")).toBe("first\n  second");
  });

  it("returns null for a hash when its question source is unavailable", () => {
    expect(reconstructParsonsAnswer("0_0")).toBeNull();
  });

  it("returns null when a hash references a missing source line", () => {
    expect(reconstructParsonsAnswer("99_0", htmlsrc)).toBeNull();
  });

  it.each([null, undefined])("treats a %s answer as empty", (answer) => {
    expect(reconstructParsonsAnswer(answer, htmlsrc)).toBe("");
  });
});
