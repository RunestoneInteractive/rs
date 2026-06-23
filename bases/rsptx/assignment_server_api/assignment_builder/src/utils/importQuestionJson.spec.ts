import { describe, expect, it } from "vitest";

import { ExerciseType, QuestionJSON, supportedExerciseTypes } from "@/types/exercises";

import { parseQuestionJsonInput, validateQuestionJsonForType } from "./importQuestionJson";

describe("parseQuestionJsonInput", () => {
  it("returns an error for empty input", () => {
    const result = parseQuestionJsonInput("   ");

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/paste the question json/i);
  });

  it("returns an error for invalid JSON", () => {
    const result = parseQuestionJsonInput("{ not valid }");

    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/not valid json/i);
  });

  it.each([
    ["array", "[1, 2, 3]"],
    ["string", '"just a string"'],
    ["number", "42"],
    ["boolean", "true"],
    ["null", "null"]
  ])("rejects JSON that is a %s, not an object", (_label, input) => {
    expect(parseQuestionJsonInput(input).error).toMatch(/must be an object/i);
  });

  it("parses a valid JSON object", () => {
    const result = parseQuestionJsonInput('{ "statement": "Hi", "optionList": [] }');

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ statement: "Hi", optionList: [] });
  });

  it("accepts surrounding whitespace", () => {
    const result = parseQuestionJsonInput('\n  { "iframeSrc": "https://x" }  \n');

    expect(result.data).toEqual({ iframeSrc: "https://x" });
  });
});

type RequiredFieldType = "string" | "array";

interface RequiredFieldSpec {
  field: string;
  type: RequiredFieldType;
}

const REQUIRED_FIELDS: Record<ExerciseType, RequiredFieldSpec[]> = {
  mchoice: [
    { field: "statement", type: "string" },
    { field: "optionList", type: "array" }
  ],
  poll: [
    { field: "statement", type: "string" },
    { field: "optionList", type: "array" }
  ],
  shortanswer: [{ field: "statement", type: "string" }],
  activecode: [{ field: "language", type: "string" }],
  parsonsprob: [{ field: "blocks", type: "array" }],
  dragndrop: [
    { field: "left", type: "array" },
    { field: "right", type: "array" },
    { field: "correctAnswers", type: "array" }
  ],
  matching: [
    { field: "left", type: "array" },
    { field: "right", type: "array" },
    { field: "correctAnswers", type: "array" }
  ],
  fillintheblank: [
    { field: "questionText", type: "string" },
    { field: "blanks", type: "array" }
  ],
  clickablearea: [{ field: "questionText", type: "string" }],
  selectquestion: [{ field: "questionList", type: "array" }],
  iframe: [{ field: "iframeSrc", type: "string" }]
};

const VALID_PAYLOADS: Record<ExerciseType, QuestionJSON> = {
  mchoice: {
    statement: "What is the capital of France?",
    optionList: [
      { choice: "Paris", feedback: "Correct!", correct: true },
      { choice: "Berlin", feedback: "No", correct: false }
    ]
  },
  poll: {
    statement: "How confident are you?",
    optionList: [{ choice: "Very" }, { choice: "Somewhat" }]
  },
  shortanswer: { statement: "Explain polymorphism.", attachment: false },
  activecode: {
    language: "python",
    prefix_code: "",
    starter_code: "pass",
    suffix_code: "",
    instructions: "Write code",
    stdin: "",
    enableCodeTailor: false,
    enableCodelens: true
  },
  parsonsprob: {
    instructions: "Arrange the blocks",
    language: "python",
    blocks: [
      { id: "b1", content: "def greet():", indent: 0 },
      { id: "b2", content: "print('hi')", indent: 1 }
    ],
    adaptive: true,
    numbered: "left",
    noindent: false
  },
  dragndrop: {
    statement: "Match the items",
    left: [{ id: "a", label: "Python" }],
    right: [{ id: "x", label: "Dynamic" }],
    correctAnswers: [["a", "x"]],
    feedback: "Try again"
  },
  matching: {
    statement: "Match the items",
    left: [{ id: "a", label: "Hash Table" }],
    right: [{ id: "x", label: "O(1)" }],
    correctAnswers: [["a", "x"]],
    feedback: "Try again"
  },
  fillintheblank: {
    questionText: "Binary search is O(___).",
    blanks: [
      { id: "blank-1", graderType: "string", exactMatch: "log n" }
    ] as unknown as QuestionJSON["blanks"]
  },
  clickablearea: {
    statement: "Click the errors",
    questionText: "<pre>x = 10</pre>",
    feedback: "Look again"
  },
  selectquestion: {
    questionList: ["q-101", "q-102"],
    questionLabels: { "q-101": "Easy", "q-102": "Hard" },
    abExperimentName: "",
    toggleOptions: [],
    dataLimitBasecourse: true
  },
  iframe: { iframeSrc: "https://example.com/sim" }
};

const ALL_TYPES = [...supportedExerciseTypes];

const wrongValueFor = (type: RequiredFieldType): unknown =>
  type === "array" ? "not-an-array" : 123;

const expectedTypeWord = (type: RequiredFieldType): RegExp =>
  type === "array" ? /must be an array/i : /must be a string/i;

describe("validateQuestionJsonForType", () => {
  it("covers every supported exercise type", () => {
    expect(Object.keys(REQUIRED_FIELDS).sort()).toEqual([...ALL_TYPES].sort());
    expect(Object.keys(VALID_PAYLOADS).sort()).toEqual([...ALL_TYPES].sort());
  });

  describe.each(ALL_TYPES)("type: %s", (type) => {
    const required = REQUIRED_FIELDS[type];

    it("accepts a fully valid payload", () => {
      expect(validateQuestionJsonForType(type, VALID_PAYLOADS[type])).toEqual([]);
    });

    it("ignores unknown/extra optional fields", () => {
      const payload = {
        ...VALID_PAYLOADS[type],
        someUnexpectedField: "whatever",
        another: 123
      } as unknown as QuestionJSON;

      expect(validateQuestionJsonForType(type, payload)).toEqual([]);
    });

    it("reports one error per required field when the payload is empty", () => {
      const errors = validateQuestionJsonForType(type, {});

      expect(errors).toHaveLength(required.length);
    });

    if (required.length > 0) {
      it.each(required)("rejects when required field $field is missing", ({ field }) => {
        const payload = { ...VALID_PAYLOADS[type] } as Record<string, unknown>;

        delete payload[field];

        const errors = validateQuestionJsonForType(type, payload as unknown as QuestionJSON);

        expect(errors.some((message) => message.includes(field))).toBe(true);
        expect(errors.some((message) => /missing required field/i.test(message))).toBe(true);
      });

      it.each(required)("rejects when required field $field is null", ({ field }) => {
        const payload = { ...VALID_PAYLOADS[type], [field]: null } as unknown as QuestionJSON;

        const errors = validateQuestionJsonForType(type, payload);

        expect(errors.some((message) => message.includes(field))).toBe(true);
      });

      it.each(required)(
        "rejects when required field $field has the wrong type ($type expected)",
        ({ field, type: fieldType }) => {
          const payload = {
            ...VALID_PAYLOADS[type],
            [field]: wrongValueFor(fieldType)
          } as unknown as QuestionJSON;

          const errors = validateQuestionJsonForType(type, payload);

          const fieldErrors = errors.filter((message) => message.includes(field));

          expect(fieldErrors).toHaveLength(1);
          expect(fieldErrors[0]).toMatch(expectedTypeWord(fieldType));
        }
      );
    }
  });

  it("aggregates multiple errors for a type with several required fields", () => {
    const errors = validateQuestionJsonForType("dragndrop", {
      left: "bad"
    } as unknown as QuestionJSON);

    expect(errors).toHaveLength(3);
    expect(errors.find((message) => message.includes("left"))).toMatch(/must be an array/i);
    expect(errors.some((message) => message.includes("right"))).toBe(true);
    expect(errors.some((message) => message.includes("correctAnswers"))).toBe(true);
  });

  it("treats an empty required array as valid (presence + type only)", () => {
    expect(validateQuestionJsonForType("mchoice", { statement: "Q", optionList: [] })).toEqual([]);
    expect(validateQuestionJsonForType("parsonsprob", { blocks: [] })).toEqual([]);
  });

  it("treats an empty required string as valid (presence + type only)", () => {
    expect(validateQuestionJsonForType("shortanswer", { statement: "" })).toEqual([]);
    expect(validateQuestionJsonForType("iframe", { iframeSrc: "" })).toEqual([]);
  });
});
