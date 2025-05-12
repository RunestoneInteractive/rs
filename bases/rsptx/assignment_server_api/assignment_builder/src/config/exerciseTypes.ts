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
