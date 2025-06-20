import { CreateExerciseFormType } from "@/types/exercises";

import { DragAndDropData } from "../components/DragAndDropExercise/types";
import { FillInTheBlankData } from "../components/FillInTheBlankExercise/types";
import { MatchingData } from "../components/MatchingExercise/types";
import { ParsonsData } from "../components/ParsonsExercise/ParsonsExercise";
import { isTipTapContentEmpty } from "../utils/validation";

export type StepValidator<T extends Partial<CreateExerciseFormType>> = (data: T) => string[];

export type StepConfig = {
  title: string;
  description: string;
};

export type ExerciseStepConfig = Record<number, StepConfig>;

// Type definition for polls
interface PollExerciseData extends Partial<CreateExerciseFormType> {
  poll_type?: string;
  scale_min?: number;
  scale_max?: number;
}

const stepConfigs: Record<string, ExerciseStepConfig> = {
  parsonsprob: {
    0: {
      title: "Select Language",
      description: "Choose the programming language for this Parsons problem"
    },
    1: {
      title: "Write Instructions",
      description: "Provide instructions for the student"
    },
    2: {
      title: "Create Content Blocks",
      description: "Enter the code blocks that students will arrange"
    },
    3: {
      title: "Manage Blocks",
      description: "Organize the code blocks in the correct order"
    },
    4: {
      title: "Exercise Settings",
      description: "Configure exercise settings such as name, points, etc."
    },
    5: {
      title: "Preview",
      description: "Preview the exercise as students will see it"
    }
  },
  shortanswer: {
    0: {
      title: "Create Question",
      description: "Write the question that students will answer"
    },
    1: {
      title: "Exercise Settings",
      description: "Configure exercise settings such as name, points, etc."
    },
    2: {
      title: "Preview",
      description: "Preview the exercise as students will see it"
    }
  },
  mchoice: {
    0: {
      title: "Create Question",
      description: "Write a clear multiple choice question"
    },
    1: {
      title: "Answer Options",
      description: "Create and manage options for your multiple choice question"
    },
    2: {
      title: "Exercise Settings",
      description: "Configure exercise settings such as name, points, etc."
    },
    3: {
      title: "Preview",
      description: "Preview the exercise as students will see it"
    }
  },
  activecode: {
    0: {
      title: "Select Language",
      description: "Choose the programming language for this active code exercise"
    },
    1: {
      title: "Write Instructions",
      description: "Provide instructions for the student"
    },
    2: {
      title: "Hidden Prefix",
      description: "Add code that runs before the student's code but is hidden from them"
    },
    3: {
      title: "Starter Code",
      description: "Provide initial code that students will see and modify"
    },
    4: {
      title: "Hidden Suffix",
      description: "Add code that runs after the student's code but is hidden from them"
    },
    5: {
      title: "Exercise Settings",
      description: "Configure exercise settings such as name, points, etc."
    },
    6: {
      title: "Preview",
      description: "Preview the exercise as students will see it"
    }
  },
  poll: {
    0: {
      title: "Create Question",
      description: "Write the question for the poll"
    },
    1: {
      title: "Poll Type",
      description: "Choose the type of poll"
    },
    2: {
      title: "Answer Options",
      description: "Create and manage options for the poll"
    },
    3: {
      title: "Exercise Settings",
      description: "Configure exercise settings such as name, points, etc."
    },
    4: {
      title: "Preview",
      description: "Preview the exercise as students will see it"
    }
  },
  dragndrop: {
    0: {
      title: "Create Statement",
      description:
        "Write clear instructions for students about how to complete the drag and drop exercise"
    },
    1: {
      title: "Content Matching",
      description: "Create blocks in both columns and connect matching items"
    },
    2: {
      title: "Exercise Settings",
      description: "Configure exercise settings such as name, points, etc."
    },
    3: {
      title: "Preview",
      description: "Preview the exercise as students will see it"
    }
  },
  matching: {
    0: {
      title: "Create Statement",
      description:
        "Write clear instructions for students about how to complete the matching exercise"
    },
    1: {
      title: "Content Matching",
      description: "Create blocks in both columns and connect matching items"
    },
    2: {
      title: "Exercise Settings",
      description: "Configure exercise settings such as name, points, etc."
    },
    3: {
      title: "Preview",
      description: "Preview the exercise as students will see it"
    }
  },
  fillintheblank: {
    0: {
      title: "Create Question",
      description:
        "Write your question text and use {blank} to indicate where input fields should appear"
    },
    1: {
      title: "Answer Fields",
      description: "Configure the answer fields for each blank in your question"
    },
    2: {
      title: "Exercise Settings",
      description: "Configure exercise settings such as name, points, etc."
    },
    3: {
      title: "Preview",
      description: "Preview the exercise as students will see it"
    }
  }
  // Add more exercise types here
};

export const getStepConfig = (exerciseType: string, step: number): StepConfig | undefined => {
  return stepConfigs[exerciseType]?.[step];
};

// Parsons Exercise Step Validators
export const PARSONS_STEP_VALIDATORS: StepValidator<ParsonsData>[] = [
  // Language
  (data: ParsonsData) => {
    const errors: string[] = [];

    if (!data.language) {
      errors.push("Please select a language");
    }
    return errors;
  },
  // Instructions
  (data: ParsonsData) => {
    const errors: string[] = [];

    if (!data.instructions || isTipTapContentEmpty(data.instructions)) {
      errors.push("Instructions are required");
    }
    return errors;
  },
  // Code Blocks
  (data: ParsonsData) => {
    const errors: string[] = [];

    if (!data.blocks?.length) {
      errors.push("Please add some code blocks");
    } else if (data.blocks.some((block) => !block.content.trim())) {
      errors.push("All blocks must contain content");
    }
    return errors;
  },
  // Settings
  (data: ParsonsData) => {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push("Exercise name is required");
    }
    if (!data.chapter) {
      errors.push("Chapter is required");
    }
    if (data.points === undefined || data.points <= 0) {
      errors.push("Points must be greater than 0");
    }
    if (data.difficulty === undefined) {
      errors.push("Difficulty is required");
    }
    return errors;
  },
  // Preview
  () => [] // Preview is always valid
];

// MultiChoice Step Validators
export const MULTI_CHOICE_STEP_VALIDATORS: StepValidator<Partial<CreateExerciseFormType>>[] = [
  // Question
  (data) => {
    const errors: string[] = [];

    if (!data.statement || isTipTapContentEmpty(data.statement)) {
      errors.push("Question content is required");
    }

    return errors;
  },
  // Options
  (data) => {
    const errors: string[] = [];
    const options = data.optionList || [];

    if (options.length < 2) {
      errors.push("You must add at least two options");
    }

    if (options.some((option) => !option.choice?.trim())) {
      errors.push("All options must have content");
    }

    if (!options.some((option) => option.correct)) {
      errors.push("At least one option must be marked as correct");
    }

    return errors;
  },
  // Settings
  (data) => {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push("Exercise name is required");
    }
    if (!data.chapter) {
      errors.push("Chapter is required");
    }
    if (!data.subchapter) {
      errors.push("Section is required");
    }
    if (data.points === undefined || data.points <= 0) {
      errors.push("Points must be greater than 0");
    }
    if (data.difficulty === undefined) {
      errors.push("Difficulty is required");
    }

    return errors;
  },
  // Preview
  () => [] // Preview is always valid
];

// ShortAnswer Exercise Step Validators
export const SHORT_ANSWER_STEP_VALIDATORS: StepValidator<Partial<CreateExerciseFormType>>[] = [
  // Question
  (data) => {
    const errors: string[] = [];

    if (!data.statement || isTipTapContentEmpty(data.statement)) {
      errors.push("Question content is required");
    }

    return errors;
  },
  // Settings
  (data) => {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push("Exercise name is required");
    }
    if (!data.chapter) {
      errors.push("Chapter is required");
    }
    if (data.points === undefined || data.points <= 0) {
      errors.push("Points must be greater than 0");
    }
    if (data.difficulty === undefined) {
      errors.push("Difficulty is required");
    }

    return errors;
  },
  // Preview
  () => [] // Preview is always valid
];

// ActiveCode Exercise Step Validators
export const ACTIVE_CODE_STEP_VALIDATORS: StepValidator<Partial<CreateExerciseFormType>>[] = [
  // Language
  (data) => {
    const errors: string[] = [];

    if (!data.language?.trim()) {
      errors.push("Programming language is required");
    }

    return errors;
  },
  // Instructions
  (data) => {
    const errors: string[] = [];

    if (!data.instructions || isTipTapContentEmpty(data.instructions)) {
      errors.push("Instructions are required");
    }

    return errors;
  },
  // Hidden Prefix
  () => [],
  // Starter Code
  () => [],
  // Hidden Suffix
  () => [],
  // Settings
  (data) => {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push("Exercise name is required");
    }
    if (!data.chapter) {
      errors.push("Chapter is required");
    }
    if (data.points === undefined || data.points <= 0) {
      errors.push("Points must be greater than 0");
    }
    if (data.difficulty === undefined) {
      errors.push("Difficulty is required");
    }

    return errors;
  },
  // Preview
  () => [] // Preview is always valid
];

// Poll Exercise Step Validators
export const POLL_STEP_VALIDATORS: StepValidator<PollExerciseData>[] = [
  // Question
  (data) => {
    const errors: string[] = [];

    if (!data.statement || isTipTapContentEmpty(data.statement)) {
      errors.push("Question content is required");
    }

    return errors;
  },
  // Poll Type
  (data) => {
    const errors: string[] = [];

    if (!data.poll_type) {
      errors.push("Poll type is required");
    }

    return errors;
  },
  // Options
  (data) => {
    const errors: string[] = [];
    const options = data.optionList || [];

    if (data.poll_type === "scale") {
      if (!data.scale_min && !data.scale_max) {
        errors.push("Scale polls must define minimum and maximum values");
      }
    } else if (data.poll_type === "options") {
      if (options.length < 2 || options.some((option) => !option.choice?.trim())) {
        errors.push("Multiple choice polls must have at least two options with content");
      }
    }

    return errors;
  },
  // Settings
  (data) => {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push("Exercise name is required");
    }
    if (!data.chapter) {
      errors.push("Chapter is required");
    }
    if (data.points === undefined || data.points <= 0) {
      errors.push("Points must be greater than 0");
    }
    if (data.difficulty === undefined) {
      errors.push("Difficulty is required");
    }

    return errors;
  },
  // Preview
  () => [] // Preview is always valid
];

// Drag and Drop Exercise Step Validators
export const DRAG_AND_DROP_STEP_VALIDATORS: StepValidator<DragAndDropData>[] = [
  // Statement
  (data) => {
    const errors: string[] = [];

    if (!data.statement || isTipTapContentEmpty(data.statement)) {
      errors.push("Statement content is required");
    }

    return errors;
  },
  // Content
  (data) => {
    const errors: string[] = [];

    // Check for items
    if (!data.left?.length || !data.right?.length) {
      errors.push("You must create items in both columns");
      return errors;
    }

    // Check for empty items
    const hasEmptyItems = [...(data.left || []), ...(data.right || [])].some(
      (item) => !item.label || item.label.trim() === ""
    );

    if (hasEmptyItems) {
      errors.push("All items must have content");
    }

    // Check for connections
    if (!data.correctAnswers?.length) {
      errors.push(
        "You need to create at least one connection between source items and matching targets"
      );
    }

    return errors;
  },
  // Settings
  (data) => {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push("Exercise name is required");
    }
    if (!data.chapter) {
      errors.push("Chapter is required");
    }
    if (data.points === undefined || data.points <= 0) {
      errors.push("Points must be greater than 0");
    }
    if (data.difficulty === undefined) {
      errors.push("Difficulty is required");
    }

    return errors;
  },
  // Preview
  () => [] // Preview is always valid
];

// Matching Exercise Step Validators - can use the same validators as DRAG_AND_DROP
export const MATCHING_STEP_VALIDATORS: StepValidator<MatchingData>[] =
  DRAG_AND_DROP_STEP_VALIDATORS;

// Fill in the Blank Exercise Step Validators
export const FILL_IN_THE_BLANK_STEP_VALIDATORS: StepValidator<FillInTheBlankData>[] = [
  (data: FillInTheBlankData) => {
    const errors: string[] = [];

    if (!data.questionText || !data.questionText.trim()) {
      errors.push("Question text is required");
      return errors;
    }

    const blankCount = (data.questionText.match(/{blank}/g) || []).length;

    if (blankCount === 0) {
      errors.push("Question must contain at least one {blank} placeholder");
    }

    return errors;
  },
  (data: FillInTheBlankData) => {
    const errors: string[] = [];
    const blanks = data.blanks || [];
    const blankCount = data.questionText ? (data.questionText.match(/{blank}/g) || []).length : 0;

    if (blanks.length === 0) {
      errors.push("You must add at least one answer field");
      return errors;
    }

    if (blanks.length < blankCount) {
      errors.push(
        `You have ${blankCount} blanks but only ${blanks.length} answer fields configured`
      );
    }

    for (let i = 0; i < blanks.length; i++) {
      const blank = blanks[i];

      if (blank.graderType === "string" && (!blank.exactMatch || !blank.exactMatch.trim())) {
        errors.push(`Answer field ${i + 1} must have an exact match value`);
      } else if (
        blank.graderType === "regex" &&
        (!blank.regexPattern || !blank.regexPattern.trim())
      ) {
        errors.push(`Answer field ${i + 1} must have a regular expression pattern`);
      } else if (blank.graderType === "number") {
        if (!blank.numberMin || !blank.numberMax) {
          errors.push(`Answer field ${i + 1} must have both minimum and maximum values`);
        } else if (parseFloat(blank.numberMin) > parseFloat(blank.numberMax)) {
          errors.push(`Answer field ${i + 1} has minimum value greater than maximum value`);
        }
      }
    }

    return errors;
  },
  (data: FillInTheBlankData) => {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push("Exercise name is required");
    }
    if (!data.chapter) {
      errors.push("Chapter is required");
    }
    if (data.points === undefined || data.points <= 0) {
      errors.push("Points must be greater than 0");
    }
    if (data.difficulty === undefined) {
      errors.push("Difficulty is required");
    }

    return errors;
  },
  () => []
];
