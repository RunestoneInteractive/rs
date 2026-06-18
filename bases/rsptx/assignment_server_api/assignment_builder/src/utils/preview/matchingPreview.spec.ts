import { generateMatchingPreview } from "./matchingPreview";

import { DEFAULT_INCORRECT_FEEDBACK } from "@/utils/questionJson";

const baseProps = {
  left: [{ id: "l1", label: "Concept A" }],
  right: [{ id: "r1", label: "Description A" }],
  correctAnswers: [["l1", "r1"]],
  feedback: "Good job!",
  name: "myExercise"
};

describe("generateMatchingPreview", () => {
  it("returns a string containing the ptx-runestone-container wrapper", () => {
    const result = generateMatchingPreview(baseProps);

    expect(result).toContain('class="ptx-runestone-container"');
  });

  it("uses the sanitized name as the element id", () => {
    const result = generateMatchingPreview({ ...baseProps, name: "my-exercise_1" });

    expect(result).toContain('id="my-exercise_1"');
  });

  it("sets data-component to matching", () => {
    const result = generateMatchingPreview(baseProps);

    expect(result).toContain('data-component="matching"');
  });

  it("embeds a JSON script block", () => {
    const result = generateMatchingPreview(baseProps);

    expect(result).toContain('<script type="application/json">');
  });

  it("includes provided statement in the embedded JSON", () => {
    const result = generateMatchingPreview({ ...baseProps, statement: "Match these items." });
    const json = extractJson(result);

    expect(json.statement).toBe("Match these items.");
  });

  it("uses default statement when statement is not provided", () => {
    const result = generateMatchingPreview({ ...baseProps, statement: undefined });
    const json = extractJson(result);

    expect(json.statement).toBe(
      "Match each concept on the left with its correct description on the right."
    );
  });

  it("includes provided feedback in the embedded JSON", () => {
    const result = generateMatchingPreview({ ...baseProps, feedback: "Try again!" });
    const json = extractJson(result);

    expect(json.feedback).toBe("Try again!");
  });

  it("uses default feedback when feedback is an empty string", () => {
    const result = generateMatchingPreview({ ...baseProps, feedback: "" });
    const json = extractJson(result);

    expect(json.feedback).toBe(DEFAULT_INCORRECT_FEEDBACK);
  });

  it("maps left items into the JSON with id and label", () => {
    const left = [
      { id: "l1", label: "Alpha" },
      { id: "l2", label: "Beta" }
    ];
    const result = generateMatchingPreview({ ...baseProps, left });
    const json = extractJson(result);

    expect(json.left).toEqual([
      { id: "l1", label: "Alpha" },
      { id: "l2", label: "Beta" }
    ]);
  });

  it("maps right items into the JSON with id and label", () => {
    const right = [
      { id: "r1", label: "First" },
      { id: "r2", label: "Second" }
    ];
    const result = generateMatchingPreview({ ...baseProps, right });
    const json = extractJson(result);

    expect(json.right).toEqual([
      { id: "r1", label: "First" },
      { id: "r2", label: "Second" }
    ]);
  });

  it("includes correctAnswers pairs in the embedded JSON", () => {
    const correctAnswers = [
      ["l1", "r2"],
      ["l2", "r1"]
    ];
    const result = generateMatchingPreview({ ...baseProps, correctAnswers });
    const json = extractJson(result);

    expect(json.correctAnswers).toEqual(correctAnswers);
  });

  it("strips wrapping <p> tags from left item labels", () => {
    const left = [{ id: "l1", label: "<p>Some text</p>" }];
    const result = generateMatchingPreview({ ...baseProps, left });
    const json = extractJson(result);

    expect(json.left[0].label).toBe("Some text");
  });

  it("strips wrapping <p> tags from right item labels", () => {
    const right = [{ id: "r1", label: "<p>Right label</p>" }];
    const result = generateMatchingPreview({ ...baseProps, right });
    const json = extractJson(result);

    expect(json.right[0].label).toBe("Right label");
  });

  it("replaces inner <p> tags with <span> tags in labels", () => {
    const left = [{ id: "l1", label: "<p>Outer<p>inner</p>text</p>" }];
    const result = generateMatchingPreview({ ...baseProps, left });
    const json = extractJson(result);

    expect(json.left[0].label).toBe("Outer<span>inner</span>text");
  });

  it("handles empty string labels without throwing", () => {
    const left = [{ id: "l1", label: "" }];
    const result = generateMatchingPreview({ ...baseProps, left });
    const json = extractJson(result);

    expect(json.left[0].label).toBe("");
  });

  it("sanitizes a name with special characters by removing them", () => {
    const result = generateMatchingPreview({ ...baseProps, name: "my exercise!" });

    expect(result).toContain('id="myexercise"');
  });

  it("prepends id_ when sanitized name does not start with a letter", () => {
    const result = generateMatchingPreview({ ...baseProps, name: "123abc" });

    expect(result).toContain('id="id_123abc"');
  });

  it("uses fallback id when name is empty", () => {
    const result = generateMatchingPreview({ ...baseProps, name: "" });

    expect(result).toMatch(/id="exercise_\d+"/);
  });
});

function extractJson(html: string): Record<string, unknown> {
  const match = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("No JSON script block found in output");
  return JSON.parse(match[1].trim());
}
