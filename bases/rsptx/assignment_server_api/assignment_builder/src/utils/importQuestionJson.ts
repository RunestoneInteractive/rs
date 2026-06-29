import { ExerciseType, QuestionJSON } from "@/types/exercises";

export interface ParsedQuestionJsonResult {
  data?: QuestionJSON;
  error?: string;
}

export type RequiredFieldType = "string" | "array" | "object";

export interface RequiredFieldRule {
  field: string;
  type: RequiredFieldType;
}

export const REQUIRED_FIELDS: Record<ExerciseType, RequiredFieldRule[]> = {
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
    { field: "statement", type: "string" },
    { field: "left", type: "array" },
    { field: "right", type: "array" },
    { field: "correctAnswers", type: "array" }
  ],
  matching: [
    { field: "statement", type: "string" },
    { field: "left", type: "array" },
    { field: "right", type: "array" },
    { field: "correctAnswers", type: "array" }
  ],
  fillintheblank: [
    { field: "questionText", type: "string" },
    { field: "blanks", type: "array" }
  ],
  clickablearea: [
    { field: "statement", type: "string" },
    { field: "questionText", type: "string" }
  ],
  selectquestion: [{ field: "questionList", type: "array" }],
  iframe: [{ field: "iframeSrc", type: "string" }]
};

export const parseQuestionJsonInput = (input: string): ParsedQuestionJsonResult => {
  const trimmed = input.trim();

  if (!trimmed) {
    return { error: "Paste the question JSON before importing." };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      error: "This is not valid JSON. Check for missing quotes, commas, or brackets."
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { error: "The JSON must be an object containing the question fields." };
  }

  return { data: parsed as QuestionJSON };
};

const matchesType = (value: unknown, type: RequiredFieldType): boolean => {
  if (type === "array") {
    return Array.isArray(value);
  }
  if (type === "object") {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  return typeof value === "string";
};

export const validateQuestionJsonForType = (type: ExerciseType, data: QuestionJSON): string[] => {
  const rules = REQUIRED_FIELDS[type] ?? [];
  const record = data as Record<string, unknown>;
  const errors: string[] = [];

  for (const rule of rules) {
    const value = record[rule.field];

    if (value === undefined || value === null) {
      errors.push(`Missing required field "${rule.field}" for this question type.`);
      continue;
    }

    if (!matchesType(value, rule.type)) {
      errors.push(
        `Field "${rule.field}" must be ${rule.type === "array" ? "an array" : `a ${rule.type}`}.`
      );
    }
  }

  return errors;
};
