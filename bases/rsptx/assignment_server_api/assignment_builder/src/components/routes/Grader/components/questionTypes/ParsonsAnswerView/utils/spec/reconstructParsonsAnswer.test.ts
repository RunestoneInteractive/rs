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

  it("formats legacy plain-text answers without block separators", () => {
    expect(reconstructParsonsAnswer("def greet(name):\n---\n    if name:")).toBe(
      "def greet(name):\n    if name:"
    );
  });

  it("returns null for a hash when its question source is unavailable", () => {
    expect(reconstructParsonsAnswer("0_0")).toBeNull();
  });

  it.each([null, undefined])("treats a %s answer as empty", (answer) => {
    expect(reconstructParsonsAnswer(answer, htmlsrc)).toBe("");
  });
});
