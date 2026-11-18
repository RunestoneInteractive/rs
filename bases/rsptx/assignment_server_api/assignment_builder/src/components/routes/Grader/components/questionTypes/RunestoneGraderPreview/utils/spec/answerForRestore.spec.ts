import { answerForRestore } from "../answerForRestore";

describe("answerForRestore", () => {
  it("parses legacy string matching answers before calling restoreAnswers", () => {
    expect(answerForRestore("matching", '{"connections":[{"from":"left","to":"right"}]}')).toEqual({
      connections: [{ from: "left", to: "right" }]
    });
  });

  it("keeps drag-and-drop JSON serialized because its component parses the string", () => {
    const answer = '{"zone":["item"]}';

    expect(answerForRestore("dragndrop", answer)).toBe(answer);
  });
});
