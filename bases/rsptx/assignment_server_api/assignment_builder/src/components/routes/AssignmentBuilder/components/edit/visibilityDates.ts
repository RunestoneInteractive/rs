import { convertDateToISO, parseUTCDate } from "@/utils/date";

import { VisibilityMode } from "./visibilityMode";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface VisibilityDates {
  visibleOn: string | null;
  hiddenOn: string | null;
}

export const applyModeDateDefaults = (
  mode: VisibilityMode,
  visibleOn: string | null,
  hiddenOn: string | null
): VisibilityDates => {
  let nextVisibleOn = visibleOn;
  let nextHiddenOn = hiddenOn;

  if ((mode === "scheduled_visible" || mode === "scheduled_period") && !nextVisibleOn) {
    const startOfDay = new Date();

    startOfDay.setHours(0, 0, 0, 0);
    nextVisibleOn = convertDateToISO(startOfDay);
  }
  if ((mode === "scheduled_hidden" || mode === "scheduled_period") && !nextHiddenOn) {
    const endOfDay = new Date();

    endOfDay.setHours(23, 59, 0, 0);
    nextHiddenOn = convertDateToISO(endOfDay);
  }
  return { visibleOn: nextVisibleOn, hiddenOn: nextHiddenOn };
};

export const adjustDatesForVisibleOnChange = (
  mode: VisibilityMode,
  visibleOn: string,
  hiddenOn: string | null
): VisibilityDates => {
  if (mode === "scheduled_period" && hiddenOn) {
    const newVisibleDate = parseUTCDate(visibleOn);
    const currentHiddenDate = parseUTCDate(hiddenOn);

    if (newVisibleDate >= currentHiddenDate) {
      return {
        visibleOn,
        hiddenOn: convertDateToISO(new Date(newVisibleDate.getTime() + DAY_MS))
      };
    }
  }
  return { visibleOn, hiddenOn };
};

export const adjustDatesForHiddenOnChange = (
  mode: VisibilityMode,
  visibleOn: string | null,
  hiddenOn: string
): VisibilityDates => {
  if (mode === "scheduled_period" && visibleOn) {
    const newHiddenDate = parseUTCDate(hiddenOn);
    const currentVisibleDate = parseUTCDate(visibleOn);

    if (newHiddenDate <= currentVisibleDate) {
      return {
        visibleOn: convertDateToISO(new Date(newHiddenDate.getTime() - DAY_MS)),
        hiddenOn
      };
    }
  }
  return { visibleOn, hiddenOn };
};
