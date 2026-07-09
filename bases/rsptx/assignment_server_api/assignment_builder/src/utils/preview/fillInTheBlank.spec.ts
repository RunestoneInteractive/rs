import { generateFillInTheBlankPreview } from "./fillInTheBlank";
import {
  BlankWithFeedback,
  GraderType
} from "@/components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/components/FillInTheBlankExercise/types";

const makeBlank = (overrides: Partial<BlankWithFeedback> = {}): BlankWithFeedback => ({
  id: "blank-1",
  graderType: GraderType.STRING,
  ...overrides
});

describe("generateFillInTheBlankPreview", () => {
  it("returns a string containing the runestone wrapper div", () => {
    const result = generateFillInTheBlankPreview({
      questionText: "Hello {blank} world",
      blanks: [makeBlank({ exactMatch: "foo" })],
      name: "myQuestion"
    });

    expect(result).toContain('class="runestone"');
    expect(result).toContain('data-component="fillintheblank"');
  });

  it("uses sanitized name as the element id", () => {
    const result = generateFillInTheBlankPreview({
      questionText: "Answer: {blank}",
      blanks: [makeBlank({ exactMatch: "yes" })],
      name: "myQuestion"
    });

    expect(result).toContain('id="myQuestion"');
  });

  it("falls back to a generated id when name is empty", () => {
    const result = generateFillInTheBlankPreview({
      questionText: "Answer: {blank}",
      blanks: [makeBlank({ exactMatch: "yes" })],
      name: ""
    });

    expect(result).toMatch(/id="fitb_\d+"/);
  });

  it("includes questionLabel in data-question_label attribute", () => {
    const result = generateFillInTheBlankPreview({
      questionText: "Q {blank}",
      blanks: [makeBlank({ exactMatch: "x" })],
      name: "q1",
      questionLabel: "Q1"
    });

    expect(result).toContain('data-question_label="Q1"');
  });

  it("uses empty string for questionLabel when not provided", () => {
    const result = generateFillInTheBlankPreview({
      questionText: "Q {blank}",
      blanks: [makeBlank({ exactMatch: "x" })],
      name: "q1"
    });

    expect(result).toContain('data-question_label=""');
  });

  it("replaces {blank} placeholders with input elements in problemHtml", () => {
    const result = generateFillInTheBlankPreview({
      questionText: "A {blank} and {blank}",
      blanks: [makeBlank({ exactMatch: "one" }), makeBlank({ exactMatch: "two" })],
      name: "q1"
    });

    const parsed = JSON.parse(extractJsonData(result));
    expect(parsed.problemHtml).toContain('<input type="text" name="x" />');
    expect(parsed.problemHtml).not.toContain("{blank}");
  });

  it("sets dyn_vars to null in the JSON payload", () => {
    const result = generateFillInTheBlankPreview({
      questionText: "Q {blank}",
      blanks: [makeBlank({ exactMatch: "a" })],
      name: "q1"
    });

    const parsed = JSON.parse(extractJsonData(result));
    expect(parsed.dyn_vars).toBeNull();
  });

  describe("STRING grader type", () => {
    it("generates a regex feedback item for exactMatch", () => {
      const blank = makeBlank({
        graderType: GraderType.STRING,
        exactMatch: "hello",
        correctFeedback: "Well done!",
        incorrectFeedback: "Try again."
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Say {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      const feedbackItems = parsed.feedbackArray[0];

      expect(feedbackItems[0].regex).toBe("^\\s*hello\\s*$");
      expect(feedbackItems[0].regexFlags).toBe("");
      expect(feedbackItems[0].feedback).toContain("Well done!");
    });

    it("uses default correct feedback when correctFeedback is not provided", () => {
      const blank = makeBlank({
        graderType: GraderType.STRING,
        exactMatch: "hello"
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Say {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      expect(parsed.feedbackArray[0][0].feedback).toContain("Correct");
    });

    it("appends an incorrect fallback feedback item", () => {
      const blank = makeBlank({
        graderType: GraderType.STRING,
        exactMatch: "hello",
        incorrectFeedback: "Nope."
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Say {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      const feedbackItems = parsed.feedbackArray[0];
      const last = feedbackItems[feedbackItems.length - 1];

      expect(last.regex).toBe("^\\s*.*\\s*$");
      expect(last.feedback).toContain("Nope.");
    });

    it("uses default incorrect feedback when incorrectFeedback is not provided", () => {
      const blank = makeBlank({
        graderType: GraderType.STRING,
        exactMatch: "hello"
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Say {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      const feedbackItems = parsed.feedbackArray[0];
      const last = feedbackItems[feedbackItems.length - 1];

      expect(last.feedback).toContain("Not quite. Try again.");
    });

    it("skips correct feedback item when exactMatch is absent", () => {
      const blank = makeBlank({
        graderType: GraderType.STRING
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Say {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      expect(parsed.feedbackArray[0]).toHaveLength(1);
    });

    it("escapes double quotes in exactMatch", () => {
      const blank = makeBlank({
        graderType: GraderType.STRING,
        exactMatch: 'say "hi"'
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Say {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      expect(parsed.feedbackArray[0][0].regex).toContain('\\"hi\\"');
    });
  });

  describe("REGEX grader type", () => {
    it("generates a regex feedback item with anchored pattern and flags", () => {
      const blank = makeBlank({
        graderType: GraderType.REGEX,
        regexPattern: "foo|bar",
        regexFlags: "i",
        correctFeedback: "Correct!"
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Match {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      const feedbackItems = parsed.feedbackArray[0];

      expect(feedbackItems[0].regex).toBe("^\\s*foo|bar\\s*$");
      expect(feedbackItems[0].regexFlags).toBe("i");
    });

    it("uses empty string for regexFlags when not provided", () => {
      const blank = makeBlank({
        graderType: GraderType.REGEX,
        regexPattern: "abc"
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Match {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      expect(parsed.feedbackArray[0][0].regexFlags).toBe("");
    });

    it("skips correct feedback item when regexPattern is absent", () => {
      const blank = makeBlank({
        graderType: GraderType.REGEX
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Match {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      expect(parsed.feedbackArray[0]).toHaveLength(1);
    });
  });

  describe("NUMBER grader type", () => {
    it("generates a number range feedback item", () => {
      const blank = makeBlank({
        graderType: GraderType.NUMBER,
        numberMin: "1.5",
        numberMax: "3.5",
        correctFeedback: "Right range!"
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Enter {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      const feedbackItems = parsed.feedbackArray[0];

      expect(feedbackItems[0].number).toEqual([1.5, 3.5]);
      expect(feedbackItems[0].feedback).toContain("Right range!");
    });

    it("parses numberMin and numberMax as floats", () => {
      const blank = makeBlank({
        graderType: GraderType.NUMBER,
        numberMin: "2",
        numberMax: "10"
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Enter {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      expect(parsed.feedbackArray[0][0].number).toEqual([2, 10]);
    });

    it("skips correct feedback item when numberMin or numberMax is absent", () => {
      const blank = makeBlank({
        graderType: GraderType.NUMBER,
        numberMin: "1"
      });

      const result = generateFillInTheBlankPreview({
        questionText: "Enter {blank}",
        blanks: [blank],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      expect(parsed.feedbackArray[0]).toHaveLength(1);
    });
  });

  describe("blankNames", () => {
    it("records the max index for multiple blanks", () => {
      const blanks = [
        makeBlank({ id: "b1", exactMatch: "a" }),
        makeBlank({ id: "b2", exactMatch: "b" }),
        makeBlank({ id: "b3", exactMatch: "c" })
      ];

      const result = generateFillInTheBlankPreview({
        questionText: "A {blank} B {blank} C {blank}",
        blanks,
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      expect(parsed.blankNames).toEqual({ x: 2 });
    });

    it("records x as 0 for a single blank", () => {
      const result = generateFillInTheBlankPreview({
        questionText: "A {blank}",
        blanks: [makeBlank({ exactMatch: "a" })],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      expect(parsed.blankNames).toEqual({ x: 0 });
    });

    it("returns empty blankNames object when there are no blanks", () => {
      const result = generateFillInTheBlankPreview({
        questionText: "No blanks here",
        blanks: [],
        name: "q1"
      });

      const parsed = JSON.parse(extractJsonData(result));
      expect(parsed.blankNames).toEqual({});
    });
  });
});

function extractJsonData(html: string): string {
  const match = html.match(/<script type="application\/json">\s*([\s\S]*?)\s*<\/script>/);
  if (!match) throw new Error("No JSON script block found in preview output");
  return match[1].trim();
}
