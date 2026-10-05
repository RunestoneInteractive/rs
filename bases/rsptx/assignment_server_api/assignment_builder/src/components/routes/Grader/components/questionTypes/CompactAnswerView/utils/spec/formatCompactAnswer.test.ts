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

  it("reconstructs Parsons blocks on separate lines", () => {
    expect(formatCompactAnswer("parsonsprob", "def greet(name):---    if name:")).toBe(
      "def greet(name):\nif name:"
    );
  });

  it("numbers fill-in-the-blank values", () => {
    expect(formatCompactAnswer("fillintheblank", '["first",""]')).toBe("1. first\n2. (empty)");
  });

  it("preserves answers for other question types", () => {
    expect(formatCompactAnswer("shortanswer", "Student response")).toBe("Student response");
  });
});
