export interface VisibilityMode {
  value: string;
  label: string;
  wizardCardName: RegExp;
  expectedBadge: RegExp;
}

export const visibilityModes: VisibilityMode[] = [
  {
    value: "hidden",
    label: "Hidden",
    wizardCardName: /Hidden from students/,
    expectedBadge: /^Hidden$/
  },
  {
    value: "visible",
    label: "Visible",
    wizardCardName: /Students can see this assignment now/,
    expectedBadge: /^Visible$/
  },
  {
    value: "scheduled_visible",
    label: "Visible on…",
    wizardCardName: /Make visible on a date/,
    expectedBadge: /^Visible$/
  },
  {
    value: "scheduled_hidden",
    label: "Hidden on…",
    wizardCardName: /Hide on a date/,
    expectedBadge: /^Until /
  },
  {
    value: "scheduled_period",
    label: "Visible during period",
    wizardCardName: /Visible during a period/,
    expectedBadge: /^Until /
  }
];
