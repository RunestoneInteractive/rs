import { generateMultiChoicePreview } from "./multichoice";

const options = [
  { choice: "4", feedback: "Yes", correct: true },
  { choice: "5", feedback: "No", correct: false }
];

describe("generateMultiChoicePreview", () => {
  it("shuffles the answers only when random is set", () => {
    expect(generateMultiChoicePreview("2+2?", options, "q")).not.toContain("data-random");
    expect(generateMultiChoicePreview("2+2?", options, "q", false, true)).toContain(
      'data-random="yes"'
    );
  });

  it("uses checkboxes for several correct answers or when forced", () => {
    expect(generateMultiChoicePreview("2+2?", options, "q")).toContain(
      'data-multipleanswers="false"'
    );
    expect(generateMultiChoicePreview("2+2?", options, "q", true)).toContain(
      'data-multipleanswers="true"'
    );
  });
});
