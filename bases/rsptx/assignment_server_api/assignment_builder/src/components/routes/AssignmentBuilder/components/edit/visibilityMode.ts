export type VisibilityMode =
  | "hidden"
  | "visible"
  | "scheduled_visible"
  | "scheduled_hidden"
  | "scheduled_period";

export const getVisibilityMode = (
  visible: boolean | null | undefined,
  visibleOn: string | null | undefined,
  hiddenOn: string | null | undefined
): VisibilityMode => {
  if (!visible) {
    if (visibleOn && hiddenOn) {
      return "scheduled_period";
    }
    if (visibleOn) {
      return "scheduled_visible";
    }
    return "hidden";
  }
  if (hiddenOn) {
    return "scheduled_hidden";
  }
  return "visible";
};

export interface VisibilityValues {
  visible: boolean;
  visible_on: string | null;
  hidden_on: string | null;
}

export const getVisibilityValues = (
  mode: VisibilityMode,
  visibleOn: string | null,
  hiddenOn: string | null
): VisibilityValues => {
  switch (mode) {
    case "hidden":
      return { visible: false, visible_on: null, hidden_on: null };
    case "visible":
      return { visible: true, visible_on: null, hidden_on: null };
    case "scheduled_visible":
      return { visible: false, visible_on: visibleOn, hidden_on: null };
    case "scheduled_hidden":
      return { visible: true, visible_on: null, hidden_on: hiddenOn };
    case "scheduled_period":
      return { visible: false, visible_on: visibleOn, hidden_on: hiddenOn };
  }
};
