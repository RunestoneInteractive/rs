import { formatCompactAnswer } from "../formatCompactAnswer";

describe("formatCompactAnswer", () => {
  it("converts multiple-choice indexes to option labels", () => {
    expect(formatCompactAnswer("mchoice", "0,2")).toBe("Option A, Option C");
  });

  it.each(["matching", "dragndrop"])("formats %s associations with question labels", (kind) => {
    const htmlsrc = `<div>
      <script type="application/json">{
        "left":[{"id":"drag-1","label":"January"}],
        "right":[{"id":"drop-1","label":"Winter"}]
      }</script>
    </div>`;
    const answer =
      kind === "matching"
        ? '{"connections":[{"from":"drag-1","to":"drop-1"}]}'
        : '{"drop-1":["drag-1"]}';

    expect(formatCompactAnswer(kind, answer, htmlsrc)).toBe("January → Winter");
  });

  it("does not expose malformed association JSON", () => {
    expect(formatCompactAnswer("matching", "not-json")).toBe("Stored answer could not be decoded.");
  });

  it("reconstructs a Parsons hash as the student's plain source code", () => {
    const htmlsrc = `<pre class="parsonsblocks">
def greet(name):
---
    if name:
---
        print(f"Hello, {name}")
    </pre>`;

    expect(formatCompactAnswer("parsonsprob", "0_0-1_1-2_2", htmlsrc)).toBe(
      'def greet(name):\n    if name:\n        print(f"Hello, {name}")'
    );
  });

  it("does not expose an undecodable Parsons hash", () => {
    expect(formatCompactAnswer("parsonsprob", "0_0")).toBe(
      "Stored answer could not be reconstructed."
    );
  });

  it.each([null, undefined])("formats a %s answer as empty", (answer) => {
    expect(formatCompactAnswer("parsonsprob", answer)).toBe("");
  });

  it("numbers fill-in-the-blank values", () => {
    expect(formatCompactAnswer("fillintheblank", '["first",""]')).toBe("1. first\n2. (empty)");
  });

  it("preserves answers for other question types", () => {
    expect(formatCompactAnswer("shortanswer", "Student response")).toBe("Student response");
  });

  it.each(["activecode", "actex", "codelens"])(
    "shows %s submissions as plain source code",
    (questionType) => {
      expect(formatCompactAnswer(questionType, "def greet():\n    print('Hello')")).toBe(
        "def greet():\n    print('Hello')"
      );
    }
  );
});
