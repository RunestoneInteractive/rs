# Question JSON Schema

## Purpose

This document defines the standardized JSON schema for the `question_json` field stored on every question/exercise record in the Runestone system. The `question_json` field is a **JSON-encoded string** that contains the type-specific content and configuration for a question - the fields that vary depending on the `question_type`.

### Source of Truth

| File | Role |
|---|---|
| `bases/rsptx/assignment_server_api/assignment_builder/src/types/exercises.ts` | TypeScript `QuestionJSON` type - canonical field-level definition |
| `bases/rsptx/assignment_server_api/assignment_builder/src/utils/questionJson.ts` | Builder (`buildQuestionJson`), defaults (`getDefaultQuestionJson`), and merge logic (`mergeQuestionJsonWithDefaults`) |

---

## Supported Question Types

Defined in `QuestionType` (Python) and `supportedExerciseTypes` (TypeScript):

| `question_type` | Display Name | Description |
|---|---|---|
| `activecode` | Active Code | Interactive coding exercise with real-time execution |
| `mchoice` | Multiple Choice | Single or multiple correct answers |
| `shortanswer` | Short Answer | Free-text response |
| `poll` | Poll | Survey / feedback question |
| `dragndrop` | Drag and Drop | Match or order items by dragging |
| `matching` | Matching | Match items from two different sets |
| `parsonsprob` | Parsons Problem | Arrange code blocks in correct order |
| `fillintheblank` | Fill in the Blank | Text with blanks to complete |
| `selectquestion` | Select Question | Meta-question that selects from a pool |
| `clickablearea` | Clickable Area | Identify areas in text or images |
| `iframe` | iFrame | Embed external content via an iframe |

> **Note:** Additional types exist in the backend enum (`video`, `codelens`, `youtube`, `hparsons`, `actex`, `page`, `webwork`) but are **not** currently supported in the assignment builder UI and do not have a `question_json` builder path.

---

## Field Reference

All fields within `question_json` are **optional** at the top level (`Partial<{...}>`). Only the fields relevant to a particular `question_type` are populated when the JSON is built.

| Field | Type | Used By Question Type(s) | Description |
|---|---|---|---|
| `statement` | `string` | `mchoice`, `poll`, `shortanswer`, `dragndrop`, `matching`, `clickablearea` | The main question/prompt text displayed to the student |
| `instructions` | `string` | `activecode`, `parsonsprob` | Instructions shown above the coding/ordering area |
| `questionText` | `string` | `fillintheblank`, `clickablearea` | Question body text (may contain `___` blank placeholders for FITB) |
| `language` | `string` | `activecode`, `parsonsprob` | Programming language (e.g. `"python"`, `"java"`, `"cpp"`) |
| `prefix_code` | `string` | `activecode` | Hidden code prepended before the student's code during execution |
| `starter_code` | `string` | `activecode` | Initial code shown in the editor for the student to modify |
| `suffix_code` | `string` | `activecode` | Hidden code appended after the student's code (typically unit tests) |
| `stdin` | `string` | `activecode` | Standard input provided to the program at runtime |
| `selectedExistingDataFiles` | `string[]` | `activecode` | List of data file names available to the code exercise |
| `enableCodeTailor` | `boolean` | `activecode` | Enable CodeTailor personalized help feature |
| `parsonspersonalize` | `"" \| "movable" \| "partial"` | `activecode` | CodeTailor Parsons personalization mode |
| `parsonsexample` | `string` | `activecode` | Example question ID used by CodeTailor |
| `enableCodelens` | `boolean` | `activecode` | Enable the Codelens step-through debugger |
| `attachment` | `boolean` | `shortanswer` | Whether file attachment upload is allowed |
| `optionList` | [`Option[]`](#option) | `mchoice`, `poll` | List of answer options |
| `forceCheckboxes` | `boolean` | `mchoice` | Force checkbox UI (for multiple-select) |
| `poll_type` | `string` | `poll` | Poll display type |
| `scale_min` | `number` | `poll` | Minimum value for scale-type polls |
| `scale_max` | `number` | `poll` | Maximum value for scale-type polls |
| `left` | [`MatchItem[]`](#matchitem) | `dragndrop`, `matching` | Left-side items for matching/drag-and-drop |
| `right` | [`MatchItem[]`](#matchitem) | `dragndrop`, `matching` | Right-side items for matching/drag-and-drop |
| `correctAnswers` | `string[][]` | `dragndrop`, `matching` | Array of `[leftId, rightId]` pairs defining correct matches |
| `feedback` | `string` | `dragndrop`, `matching`, `clickablearea` | Feedback text shown on incorrect answer |
| `blocks` | [`ParsonsBlock[]`](#parsonsblock) | `parsonsprob` | Code blocks for Parsons problems |
| `adaptive` | `boolean` | `parsonsprob` | Enable adaptive Parsons mode (provides hints) |
| `numbered` | `"left" \| "right" \| "none"` | `parsonsprob` | Show line numbers and their position |
| `noindent` | `boolean` | `parsonsprob` | Disable indentation in the Parsons problem |
| `grader` | `"line" \| "dag"` | `parsonsprob` | Grading strategy: line-by-line or DAG-based |
| `orderMode` | `"random" \| "custom"` | `parsonsprob` | Block presentation order |
| `customOrder` | `number[]` | `parsonsprob` | Custom block ordering indices (when `orderMode` = `"custom"`) |
| `blanks` | [`BlankWithFeedback[]`](#blankwithfeedback) | `fillintheblank` | Definitions for each blank |
| `questionList` | `string[]` | `selectquestion` | Pool of question IDs to select from |
| `questionLabels` | `Record<string, string>` | `selectquestion` | Mapping of question IDs to human-readable labels |
| `abExperimentName` | `string` | `selectquestion` | A/B experiment name for randomized question selection |
| `toggleOptions` | `string[]` | `selectquestion` | Toggle configuration options |
| `dataLimitBasecourse` | `boolean` | `selectquestion` | Limit question pool to the base course |
| `iframeSrc` | `string` | `iframe` | URL of the external content to embed |

---

## Sub-Object Schemas

### `Option`

Represents a single answer option for multiple-choice or poll questions.

**Source:** `types/exercises.ts` - `interface Option`

| Field | Type | Required | Description |
|---|---|---|---|
| `choice` | `string` | ✅ | The text of the answer option |
| `feedback` | `string` | ❌ | Feedback shown when this option is selected |
| `correct` | `boolean` | ❌ | Whether this option is a correct answer |

```json
{ "choice": "Paris", "feedback": "Correct!", "correct": true }
```

---

### `MatchItem`

Represents a single item on the left or right side of a drag-and-drop or matching exercise.

**Source:** `types/exercises.ts` - inline type on `left` and `right` fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique identifier for the item (e.g. `"a"`, `"x"`) |
| `label` | `string` | ✅ | Display text for the item |

```json
{ "id": "a", "label": "Python" }
```

---

### `ParsonsBlock`

Represents a single code block in a Parsons problem.

**Source:** `utils/preview/parsonsPreview.tsx` - `interface ParsonsBlock`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique identifier for the block |
| `content` | `string` | ✅ | The code/text content of the block |
| `indent` | `number` | ✅ | Indentation level (0-based) |
| `isDistractor` | `boolean` | ❌ | Whether this block is a distractor (should not be used in the solution) |
| `isPaired` | `boolean` | ❌ | Whether this block is part of a paired distractor |
| `groupId` | `string` | ❌ | Group identifier for paired distractors |
| `isCorrect` | `boolean` | ❌ | Whether this is a correct block |
| `tag` | `string` | ❌ | Tag for DAG grading dependencies |
| `depends` | `string[]` | ❌ | Tags of blocks this block depends on (DAG grading) |
| `explanation` | `string` | ❌ | Explanation shown during adaptive feedback |
| `displayOrder` | `number` | ❌ | Custom display ordering index |
| `pairedWithBlockAbove` | `boolean` | ❌ | Whether this block is paired with the block immediately above |

```json
{
  "id": "block-1",
  "content": "def greet():",
  "indent": 0,
  "isDistractor": false,
  "tag": "def"
}
```

---

### `BlankWithFeedback`

Represents a single blank in a fill-in-the-blank question, including its grading configuration.

**Source:** `components/.../FillInTheBlankExercise/types.ts` - `interface BlankWithFeedback`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique identifier for the blank |
| `graderType` | `"string" \| "regex" \| "number"` | ✅ | How this blank is graded |
| `exactMatch` | `string` | ❌ | Expected exact string (when `graderType` = `"string"`) |
| `regexPattern` | `string` | ❌ | Regex pattern to match (when `graderType` = `"regex"`) |
| `regexFlags` | `string` | ❌ | Regex flags, e.g. `"i"` for case-insensitive (when `graderType` = `"regex"`) |
| `numberMin` | `string` | ❌ | Minimum acceptable number as string (when `graderType` = `"number"`) |
| `numberMax` | `string` | ❌ | Maximum acceptable number as string (when `graderType` = `"number"`) |
| `correctFeedback` | `string` | ❌ | Feedback shown on correct answer |
| `incorrectFeedback` | `string` | ❌ | Feedback shown on incorrect answer |

```json
{
  "id": "blank-1",
  "graderType": "regex",
  "regexPattern": "sorted|ordered",
  "regexFlags": "i",
  "correctFeedback": "Correct!",
  "incorrectFeedback": "Binary search requires a precondition on the input."
}
```

---

## Per-Question-Type Field Mapping

This section shows exactly which fields are serialized into `question_json` for each `question_type`, as implemented by `buildQuestionJson()`.

### `activecode`

| Field | Type | Default |
|---|---|---|
| `prefix_code` | `string` | `""` |
| `starter_code` | `string` | `""` |
| `suffix_code` | `string` | `""` |
| `instructions` | `string` | `""` |
| `language` | `string` | First available language option |
| `stdin` | `string` | `""` |
| `selectedExistingDataFiles` | `string[]` | - |
| `enableCodeTailor` | `boolean` | `false` |
| `parsonspersonalize` | `"" \| "movable" \| "partial"` | `""` |
| `parsonsexample` | `string` | `""` |
| `enableCodelens` | `boolean` | `true` |

### `mchoice`

| Field | Type | Default |
|---|---|---|
| `statement` | `string` | `""` |
| `optionList` | `Option[]` | Two empty options |

### `shortanswer`

| Field | Type | Default |
|---|---|---|
| `attachment` | `boolean` | `false` |
| `statement` | `string` | `""` |

### `poll`

| Field | Type | Default |
|---|---|---|
| `statement` | `string` | `""` |
| `optionList` | `Option[]` | Two empty options |

### `dragndrop`

| Field | Type | Default |
|---|---|---|
| `statement` | `string` | `""` |
| `left` | `MatchItem[]` | `[{ id: "a", label: "" }]` |
| `right` | `MatchItem[]` | `[{ id: "x", label: "" }]` |
| `correctAnswers` | `string[][]` | `[["a", "x"]]` |
| `feedback` | `string` | `"Incorrect. Please try again."` |

### `matching`

| Field | Type | Default |
|---|---|---|
| `statement` | `string` | `""` |
| `left` | `MatchItem[]` | `[{ id: "a", label: "" }]` |
| `right` | `MatchItem[]` | `[{ id: "x", label: "" }]` |
| `correctAnswers` | `string[][]` | `[["a", "x"]]` |
| `feedback` | `string` | `"Incorrect. Please try again."` |

### `parsonsprob`

| Field | Type | Default |
|---|---|---|
| `blocks` | `ParsonsBlock[]` | One empty block |
| `language` | `string` | First available language option |
| `instructions` | `string` | `""` |
| `adaptive` | `boolean` | `true` |
| `numbered` | `"left" \| "right" \| "none"` | `"left"` |
| `noindent` | `boolean` | `false` |

### `fillintheblank`

| Field | Type | Default |
|---|---|---|
| `questionText` | `string` | - |
| `blanks` | `BlankWithFeedback[]` | - |

### `selectquestion`

| Field | Type | Default |
|---|---|---|
| `questionList` | `string[]` | - |
| `questionLabels` | `Record<string, string>` | `{}` |
| `abExperimentName` | `string` | - |
| `toggleOptions` | `string[]` | - |
| `dataLimitBasecourse` | `boolean` | - |

### `clickablearea`

| Field | Type | Default |
|---|---|---|
| `questionText` | `string` | - |
| `statement` | `string` | `""` |
| `feedback` | `string` | `"Incorrect. Please try again."` |

### `iframe`

| Field | Type | Default |
|---|---|---|
| `iframeSrc` | `string` | - |

---

## Full Example JSON Objects

### Active Code

```json
{
  "prefix_code": "import math\n",
  "starter_code": "def solve(n):\n    # your code here\n    pass",
  "suffix_code": "assert solve(5) == 120",
  "instructions": "Write a function that computes the factorial of n.",
  "language": "python",
  "stdin": "",
  "selectedExistingDataFiles": [],
  "enableCodeTailor": false,
  "parsonspersonalize": "",
  "parsonsexample": "",
  "enableCodelens": true
}
```

### Multiple Choice

```json
{
  "statement": "What is the capital of France?",
  "optionList": [
    { "choice": "London", "feedback": "London is the capital of the UK.", "correct": false },
    { "choice": "Berlin", "feedback": "Berlin is the capital of Germany.", "correct": false },
    { "choice": "Paris", "feedback": "Correct!", "correct": true },
    { "choice": "Madrid", "feedback": "Madrid is the capital of Spain.", "correct": false }
  ]
}
```

### Short Answer

```json
{
  "statement": "Explain the concept of polymorphism in object-oriented programming.",
  "attachment": false
}
```

### Poll

```json
{
  "statement": "How confident are you with recursion?",
  "optionList": [
    { "choice": "Very confident" },
    { "choice": "Somewhat confident" },
    { "choice": "Not confident" }
  ]
}
```

### Drag and Drop

```json
{
  "statement": "Match each language to its type system.",
  "left": [
    { "id": "a", "label": "Python" },
    { "id": "b", "label": "Java" }
  ],
  "right": [
    { "id": "x", "label": "Dynamically typed" },
    { "id": "y", "label": "Statically typed" }
  ],
  "correctAnswers": [["a", "x"], ["b", "y"]],
  "feedback": "Incorrect. Please try again."
}
```

### Matching

```json
{
  "statement": "Match the data structure to its time complexity for search.",
  "left": [
    { "id": "a", "label": "Hash Table" },
    { "id": "b", "label": "Linked List" }
  ],
  "right": [
    { "id": "x", "label": "O(1) average" },
    { "id": "y", "label": "O(n)" }
  ],
  "correctAnswers": [["a", "x"], ["b", "y"]],
  "feedback": "Incorrect. Review the data structures chapter."
}
```

### Parsons Problem

```json
{
  "instructions": "Arrange the code blocks to create a function that prints 'Hello World'.",
  "language": "python",
  "blocks": [
    { "id": "block-1", "content": "def greet():", "indent": 0 },
    { "id": "block-2", "content": "print('Hello World')", "indent": 1 },
    { "id": "block-3", "content": "greet()", "indent": 0 },
    { "id": "block-4", "content": "print('Goodbye')", "indent": 1, "isDistractor": true }
  ],
  "adaptive": true,
  "numbered": "left",
  "noindent": false
}
```

### Fill in the Blank

```json
{
  "questionText": "The time complexity of binary search is O(___) and it requires a ___ array.",
  "blanks": [
    {
      "id": "blank-1",
      "graderType": "string",
      "exactMatch": "log n",
      "correctFeedback": "Correct!",
      "incorrectFeedback": "Think about how the search space is halved each time."
    },
    {
      "id": "blank-2",
      "graderType": "regex",
      "regexPattern": "sorted|ordered",
      "regexFlags": "i",
      "correctFeedback": "Correct!",
      "incorrectFeedback": "Binary search has a precondition on the input."
    }
  ]
}
```

### Select Question

```json
{
  "questionList": ["q-101", "q-102", "q-103"],
  "questionLabels": {
    "q-101": "Easy recursion",
    "q-102": "Medium recursion",
    "q-103": "Hard recursion"
  },
  "abExperimentName": "",
  "toggleOptions": [],
  "dataLimitBasecourse": true
}
```

### Clickable Area

```json
{
  "statement": "Click on the lines that contain a syntax error.",
  "questionText": "<pre>x = 10\nif x = 10:\n    print(x)\n</pre>",
  "feedback": "Look for assignment vs. comparison operators."
}
```

### iFrame

```json
{
  "iframeSrc": "https://example.com/interactive-simulation"
}
```

---

## Default Values

When a new question is created, `getDefaultQuestionJson()` (in `questionJson.ts`) provides the following defaults:

| Field | Default Value |
|---|---|
| `statement` | `""` |
| `language` | First value from available language options |
| `instructions` | `""` |
| `prefix_code` | `""` |
| `starter_code` | `""` |
| `suffix_code` | `""` |
| `stdin` | `""` |
| `attachment` | `false` |
| `optionList` | `[{ choice: "", feedback: "", correct: false }, { choice: "", feedback: "", correct: false }]` |
| `left` | `[{ id: "a", label: "" }]` |
| `right` | `[{ id: "x", label: "" }]` |
| `correctAnswers` | `[["a", "x"]]` |
| `feedback` | `"Incorrect. Please try again."` |
| `blocks` | `[{ id: "block-<timestamp>", content: "", indent: 0 }]` |
| `adaptive` | `true` |
| `numbered` | `"left"` |
| `noindent` | `false` |
| `enableCodeTailor` | `false` |
| `parsonspersonalize` | `""` |
| `parsonsexample` | `""` |
| `enableCodelens` | `true` |

---

## Implementation Notes

1. **Storage format:** `question_json` is stored as a **JSON-encoded string** on the `Exercise` record. The `buildQuestionJson()` function serializes via `JSON.stringify()`, and only includes the fields relevant to the given `question_type`.

2. **Type-conditional inclusion:** `buildQuestionJson()` uses spread-with-conditional patterns (`...(type === "x" && { ... })`) so that irrelevant fields for a question type are **never** included in the serialized JSON.
