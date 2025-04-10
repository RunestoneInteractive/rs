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

export const availableColors = [
  "blue",
  "green",
  "yellow",
  "cyan",
  "pink",
  "indigo",
  "teal",
  "orange",
  "bluegray",
  "purple",
  "red",
  "primary",
  "success",
  "info",
  "warning",
  "help",
  "danger"
] as const;

export type AvailableColor = (typeof availableColors)[number];

export interface ColorScheme {
  background: string;
  text: string;
}

export const generateColorScheme = (color: AvailableColor): ColorScheme => ({
  background: `var(--${color}-50)`,
  text: `var(--${color}-700)`
});

export const colorSchemes = availableColors.map((colorName) => generateColorScheme(colorName));

export const exerciseDescriptions: Record<string, string> = {
  mchoice: "Create a multiple choice question with single or multiple correct answers",
  parsons: "Create a programming exercise where students arrange code blocks in the correct order",
  activecode: "Create an interactive coding exercise with real-time execution",
  fillintheblank: "Create a text with missing words that students need to fill in",
  dragndrop: "Create an exercise where students match or order items by dragging",
  clickablearea: "Create an exercise where students identify areas in text or images",
  poll: "Create a survey question to gather student feedback",
  shortanswer: "Create a question that requires a text response"
};
