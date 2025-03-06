export interface ExerciseTypeConfig {
  label: string;
  value: string;
  tag: string;
  description: string;
  color: {
    background: string;
    text: string;
  };
}

export const exerciseTypes: ExerciseTypeConfig[] = [
  {
    label: "Multiple Choice",
    value: "mchoice",
    tag: "mchoice",
    description: "Create a multiple choice question with single or multiple correct answers",
    color: {
      background: "var(--green-50)",
      text: "var(--green-700)"
    }
  },
  {
    label: "Parsons Problem",
    value: "parsons",
    tag: "parsons",
    description:
      "Create a programming exercise where students arrange code blocks in the correct order",
    color: {
      background: "var(--blue-50)",
      text: "var(--blue-700)"
    }
  },
  {
    label: "Active Code",
    value: "activecode",
    tag: "activecode",
    description: "Create an interactive coding exercise with real-time execution",
    color: {
      background: "var(--purple-50)",
      text: "var(--purple-700)"
    }
  },
  {
    label: "Fill in the Blank",
    value: "fillintheblank",
    tag: "fillintheblank",
    description: "Create a text with missing words that students need to fill in",
    color: {
      background: "var(--orange-50)",
      text: "var(--orange-700)"
    }
  },
  {
    label: "Drag and Drop",
    value: "dragndrop",
    tag: "dragndrop",
    description: "Create an exercise where students match or order items by dragging",
    color: {
      background: "var(--cyan-50)",
      text: "var(--cyan-700)"
    }
  },
  {
    label: "Clickable Area",
    value: "clickablearea",
    tag: "clickablearea",
    description: "Create an exercise where students identify areas in text or images",
    color: {
      background: "var(--yellow-50)",
      text: "var(--yellow-700)"
    }
  },
  {
    label: "Poll",
    value: "poll",
    tag: "poll",
    description: "Create a survey question to gather student feedback",
    color: {
      background: "var(--pink-50)",
      text: "var(--pink-700)"
    }
  },
  {
    label: "Short Answer",
    value: "shortanswer",
    tag: "shortanswer",
    description: "Create a question that requires a text response",
    color: {
      background: "var(--indigo-50)",
      text: "var(--indigo-700)"
    }
  }
];
