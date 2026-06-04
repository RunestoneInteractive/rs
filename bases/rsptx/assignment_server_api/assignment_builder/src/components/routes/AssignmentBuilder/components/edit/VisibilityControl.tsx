import { Radio } from "@mantine/core";
import { Control, Controller, UseFormSetValue } from "react-hook-form";

import { Assignment } from "@/types/assignment";
import { convertDateToISO, formatUTCDateLocaleString, parseUTCDate } from "@/utils/date";

import { DateTimePicker } from "../../../../ui/DateTimePicker";

import { getVisibilityMode, VisibilityMode } from "./visibilityMode";

import styles from "./VisibilityControl.module.css";

interface VisibilityControlProps {
  control: Control<Assignment>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: (name: keyof Assignment) => any;
  setValue: UseFormSetValue<Assignment>;
}

const VISIBILITY_OPTIONS: { value: VisibilityMode; title: string; description: string }[] = [
  { value: "visible", title: "Visible", description: "Students can see this assignment now" },
  { value: "hidden", title: "Hidden", description: "Hidden from students" },
  {
    value: "scheduled_visible",
    title: "Make visible on a date",
    description: "Hidden until the date you choose"
  },
  {
    value: "scheduled_hidden",
    title: "Hide on a date",
    description: "Visible until the date you choose"
  },
  {
    value: "scheduled_period",
    title: "Visible during a period",
    description: "Visible only between two dates"
  }
];

export const VisibilityControl = ({ control, watch, setValue }: VisibilityControlProps) => {
  const visible = watch("visible");
  const visibleOn = watch("visible_on");
  const hiddenOn = watch("hidden_on");

  const visibilityMode = getVisibilityMode(visible, visibleOn, hiddenOn);

  const DAY_MS = 24 * 60 * 60 * 1000;

  const handleVisibleOnChange = (val: string) => {
    setValue("visible_on", val);
    if (hiddenOn) {
      const newVisibleDate = parseUTCDate(val);
      const currentHiddenDate = parseUTCDate(hiddenOn);

      if (newVisibleDate >= currentHiddenDate) {
        const adjusted = new Date(newVisibleDate.getTime() + DAY_MS);

        setValue("hidden_on", convertDateToISO(adjusted));
      }
    }
  };

  const handleHiddenOnChange = (val: string) => {
    setValue("hidden_on", val);
    if (visibleOn) {
      const newHiddenDate = parseUTCDate(val);
      const currentVisibleDate = parseUTCDate(visibleOn);

      if (newHiddenDate <= currentVisibleDate) {
        const adjusted = new Date(newHiddenDate.getTime() - DAY_MS);

        setValue("visible_on", convertDateToISO(adjusted));
      }
    }
  };

  const handleModeChange = (mode: VisibilityMode) => {
    switch (mode) {
      case "hidden":
        setValue("visible", false);
        setValue("visible_on", null);
        setValue("hidden_on", null);
        break;
      case "visible":
        setValue("visible", true);
        setValue("visible_on", null);
        setValue("hidden_on", null);
        break;
      case "scheduled_visible":
        setValue("visible", false);
        setValue("hidden_on", null);
        if (!visibleOn) {
          const startOfDay = new Date();

          startOfDay.setHours(0, 0, 0, 0);
          setValue("visible_on", convertDateToISO(startOfDay));
        }
        break;
      case "scheduled_hidden":
        setValue("visible", true);
        setValue("visible_on", null);
        if (!hiddenOn) {
          const endOfDay = new Date();

          endOfDay.setHours(23, 59, 0, 0);
          setValue("hidden_on", convertDateToISO(endOfDay));
        }
        break;
      case "scheduled_period":
        setValue("visible", false);
        if (!visibleOn) {
          const startOfDay = new Date();

          startOfDay.setHours(0, 0, 0, 0);
          setValue("visible_on", convertDateToISO(startOfDay));
        }
        if (!hiddenOn) {
          const endOfDay = new Date();

          endOfDay.setHours(23, 59, 0, 0);
          setValue("hidden_on", convertDateToISO(endOfDay));
        }
        break;
    }
  };

  const renderScheduleInputs = (mode: VisibilityMode) => {
    if (mode !== visibilityMode) {
      return null;
    }

    if (mode === "scheduled_visible") {
      return (
        <div className={styles.cardInputs}>
          <Controller
            name="visible_on"
            control={control}
            render={({ field: dateField }) => (
              <DateTimePicker
                value={dateField.value}
                onChange={(val) => dateField.onChange(val)}
                utc
                ariaLabel="Visible on date"
              />
            )}
          />
        </div>
      );
    }

    if (mode === "scheduled_hidden") {
      return (
        <div className={styles.cardInputs}>
          <Controller
            name="hidden_on"
            control={control}
            render={({ field: dateField }) => (
              <DateTimePicker
                value={dateField.value}
                onChange={(val) => dateField.onChange(val)}
                utc
                ariaLabel="Hidden on date"
              />
            )}
          />
        </div>
      );
    }

    if (mode === "scheduled_period") {
      return (
        <div className={styles.cardInputs}>
          <div>
            <label className={styles.inputLabel} htmlFor="visibility-visible-from">
              Visible from
            </label>
            <Controller
              name="visible_on"
              control={control}
              render={({ field: dateField }) => (
                <DateTimePicker
                  id="visibility-visible-from"
                  value={dateField.value}
                  onChange={(val) => handleVisibleOnChange(val)}
                  utc
                />
              )}
            />
          </div>
          <div>
            <label className={styles.inputLabel} htmlFor="visibility-hidden-after">
              Hidden after
            </label>
            <Controller
              name="hidden_on"
              control={control}
              render={({ field: dateField }) => (
                <DateTimePicker
                  id="visibility-hidden-after"
                  value={dateField.value}
                  onChange={(val) => handleHiddenOnChange(val)}
                  utc
                />
              )}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      <Radio.Group
        value={visibilityMode}
        onChange={(mode) => handleModeChange(mode as VisibilityMode)}
        aria-label="Visibility"
      >
        <div className={styles.cards}>
          {VISIBILITY_OPTIONS.map((option) => (
            <div key={option.value}>
              <Radio.Card value={option.value} className={styles.radioCard}>
                <div className={styles.cardRow}>
                  <Radio.Indicator size="sm" />
                  <div className={styles.cardBody}>
                    <span className={styles.cardTitle}>{option.title}</span>
                    <span className={styles.cardDesc}>{option.description}</span>
                  </div>
                </div>
              </Radio.Card>
              {renderScheduleInputs(option.value)}
            </div>
          ))}
        </div>
      </Radio.Group>
      <p className={styles.summary}>
        {visibilityMode === "hidden" && "Assignment is hidden from students"}
        {visibilityMode === "visible" && "Assignment is currently visible to students"}
        {visibilityMode === "scheduled_visible" &&
          visibleOn &&
          `Assignment will become visible on ${formatUTCDateLocaleString(visibleOn)}`}
        {visibilityMode === "scheduled_hidden" &&
          hiddenOn &&
          `Assignment will be hidden on ${formatUTCDateLocaleString(hiddenOn)}`}
        {visibilityMode === "scheduled_period" &&
          visibleOn &&
          hiddenOn &&
          `Assignment will be visible from ${formatUTCDateLocaleString(visibleOn)} until ${formatUTCDateLocaleString(hiddenOn)}`}
      </p>
    </div>
  );
};
