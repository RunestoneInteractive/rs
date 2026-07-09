import { PrimeIconName } from "@/components/ui/Icon";

export type ExerciseFamily = "choice" | "code" | "interactive" | "text" | "meta";

export interface ExerciseColorScheme {
  hue: string;
  background: string;
  text: string;
}

export interface ExerciseTypeConfig {
  label: string;
  value: string;
  tag: string;
  description: string;
  color: ExerciseColorScheme;
}

export interface ExerciseFamilyConfig {
  label: string;
  types: string[];
}

export const exerciseFamilies: Record<ExerciseFamily, ExerciseFamilyConfig> = {
  choice: { label: "Choice", types: ["mchoice", "poll"] },
  code: { label: "Code", types: ["activecode", "parsonsprob"] },
  interactive: { label: "Interactive", types: ["dragndrop", "matching", "clickablearea"] },
  text: { label: "Text", types: ["fillintheblank", "shortanswer"] },
  meta: { label: "Meta", types: ["selectquestion", "iframe"] }
};

const typeToFamily = new Map<string, ExerciseFamily>(
  (Object.keys(exerciseFamilies) as ExerciseFamily[]).flatMap((family) =>
    exerciseFamilies[family].types.map((type): [string, ExerciseFamily] => [type, family])
  )
);

export const getExerciseFamily = (type: string): ExerciseFamily => typeToFamily.get(type) ?? "meta";

export const getExerciseColorScheme = (type: string): ExerciseColorScheme => {
  const family = getExerciseFamily(type);

  return {
    hue: `var(--rs-extype-${family})`,
    background: `var(--rs-extype-${family}-bg)`,
    text: `var(--rs-extype-${family}-text)`
  };
};

const exerciseTypeIcons: Record<string, PrimeIconName> = {
  mchoice: "check-square",
  poll: "chart-bar",
  activecode: "code",
  parsonsprob: "puzzle",
  dragndrop: "drag-drop",
  matching: "link",
  clickablearea: "click",
  fillintheblank: "forms",
  shortanswer: "comment",
  selectquestion: "list-search",
  iframe: "external-link"
};

export const getExerciseTypeIcon = (type: string): PrimeIconName =>
  exerciseTypeIcons[type] ?? "file-edit";

const exerciseTypeLabelOverrides: Record<string, string> = {
  parsonsprob: "Parsons problem"
};

export const getExerciseTypeLabel = (type: string, serverLabel: string): string =>
  exerciseTypeLabelOverrides[type] ?? serverLabel;

export const difficultyOptions = {
  1: "Very easy",
  2: "Easy",
  3: "Medium",
  4: "Hard",
  5: "Very hard"
};
