export type ExerciseFamily = "choice" | "code" | "interactive" | "text" | "meta";

export interface ExerciseValidationCase {
  errorText: string;
  blockedStepHeading: string;
  unblockedStepHeading: string;
}

export interface ExerciseMatrixEntry {
  type: string;
  family: ExerciseFamily;
  cardLabel: RegExp;
  steps: string[];
  enabled: boolean;
  validation?: ExerciseValidationCase;
}

export const exerciseMatrix: ExerciseMatrixEntry[] = [
  {
    type: "mchoice",
    family: "choice",
    cardLabel: /Multiple Choice/i,
    steps: ["Question", "Options", "Settings", "Preview"],
    enabled: true,
    validation: {
      errorText: "Question content is required",
      blockedStepHeading: "Create question",
      unblockedStepHeading: "Answer options"
    }
  },
  {
    type: "poll",
    family: "choice",
    cardLabel: /Poll/i,
    steps: ["Question", "Poll type", "Options", "Settings", "Preview"],
    enabled: true,
    validation: {
      errorText: "Question content is required",
      blockedStepHeading: "Create question",
      unblockedStepHeading: "Poll type"
    }
  },
  {
    type: "activecode",
    family: "code",
    cardLabel: /Active Code/i,
    steps: [
      "Language",
      "Data files",
      "Instructions",
      "Hidden prefix",
      "Starter code",
      "Hidden suffix",
      "Standard input",
      "Settings",
      "Preview"
    ],
    enabled: true,
    validation: {
      errorText: "Programming language is required",
      blockedStepHeading: "Select language",
      unblockedStepHeading: "Data files"
    }
  },
  {
    type: "parsonsprob",
    family: "code",
    cardLabel: /Parsons/i,
    steps: ["Language", "Instructions", "Code blocks", "Settings", "Preview"],
    enabled: true,
    validation: {
      errorText: "Select a language",
      blockedStepHeading: "Select language",
      unblockedStepHeading: "Write instructions"
    }
  },
  {
    type: "dragndrop",
    family: "interactive",
    cardLabel: /Drag/i,
    steps: ["Statement", "Content", "Settings", "Preview"],
    enabled: true,
    validation: {
      errorText: "Statement content is required",
      blockedStepHeading: "Create statement",
      unblockedStepHeading: "Content matching"
    }
  },
  {
    type: "matching",
    family: "interactive",
    cardLabel: /Matching/i,
    steps: ["Statement", "Content", "Settings", "Preview"],
    enabled: true,
    validation: {
      errorText: "Statement content is required",
      blockedStepHeading: "Create statement",
      unblockedStepHeading: "Content matching"
    }
  },
  {
    type: "clickablearea",
    family: "interactive",
    cardLabel: /Clickable/i,
    steps: ["Content", "Settings", "Preview"],
    enabled: true,
    validation: {
      errorText: "Question statement is required",
      blockedStepHeading: "Create content",
      unblockedStepHeading: "Exercise settings"
    }
  },
  {
    type: "fillintheblank",
    family: "text",
    cardLabel: /Fill in the Blank/i,
    steps: ["Question", "Answer fields", "Settings", "Preview"],
    enabled: true,
    validation: {
      errorText: "Question text is required",
      blockedStepHeading: "Create question",
      unblockedStepHeading: "Answer fields"
    }
  },
  {
    type: "shortanswer",
    family: "text",
    cardLabel: /Short Answer/i,
    steps: ["Question", "Settings", "Preview"],
    enabled: true,
    validation: {
      errorText: "Question content is required",
      blockedStepHeading: "Create question",
      unblockedStepHeading: "Exercise settings"
    }
  },
  {
    type: "selectquestion",
    family: "meta",
    cardLabel: /Select Question/i,
    steps: ["Questions", "Interaction mode", "Settings", "Preview"],
    enabled: true,
    validation: {
      errorText: "Add at least one question",
      blockedStepHeading: "AB experiment and questions",
      unblockedStepHeading: "Toggle options"
    }
  },
  {
    type: "iframe",
    family: "meta",
    cardLabel: /Frame/i,
    steps: ["Iframe URL", "Settings", "Preview"],
    enabled: true,
    validation: {
      errorText: "Iframe URL is required",
      blockedStepHeading: "Iframe URL",
      unblockedStepHeading: "Exercise settings"
    }
  }
];

export const enabledExerciseTypes = exerciseMatrix.filter((entry) => entry.enabled);
