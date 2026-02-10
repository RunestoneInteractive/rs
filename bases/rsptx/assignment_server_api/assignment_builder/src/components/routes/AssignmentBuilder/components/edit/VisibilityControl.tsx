import { RadioButton } from "primereact/radiobutton";
import { Control, Controller, UseFormSetValue } from "react-hook-form";

import { Assignment } from "@/types/assignment";
import { convertDateToISO, formatUTCDateLocaleString } from "@/utils/date";

import { DateTimePicker } from "../../../../ui/DateTimePicker";

// eslint-disable-next-line no-restricted-imports
import styles from "../../AssignmentBuilder.module.css";

interface VisibilityControlProps {
  control: Control<Assignment>;
  watch: (name: keyof Assignment) => any;
  setValue: UseFormSetValue<Assignment>;
}

type VisibilityMode =
  | "hidden"
  | "visible"
  | "scheduled_visible"
  | "scheduled_hidden"
  | "scheduled_period";

export const VisibilityControl = ({ control, watch, setValue }: VisibilityControlProps) => {
  const visible = watch("visible");
  const visibleOn = watch("visible_on");
  const hiddenOn = watch("hidden_on");

  // Determine current visibility mode
  const getVisibilityMode = (): VisibilityMode => {
    if (!visible) {
      if (visibleOn && hiddenOn) {
        return "scheduled_period";
      }
      if (visibleOn) {
        return "scheduled_visible";
      }
      return "hidden";
    } else {
      if (hiddenOn) {
        return "scheduled_hidden";
      }
      return "visible";
    }
  };

  const visibilityMode = getVisibilityMode();

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
        // Keep visible_on or set to current date if null
        if (!visibleOn) {
          setValue("visible_on", convertDateToISO(new Date()));
        }
        break;
      case "scheduled_hidden":
        setValue("visible", true);
        setValue("visible_on", null);
        // Keep hidden_on or set to current date if null
        if (!hiddenOn) {
          setValue("hidden_on", convertDateToISO(new Date()));
        }
        break;
      case "scheduled_period":
        setValue("visible", false);
        // Set both dates if not already set
        if (!visibleOn) {
          const now = new Date();
          setValue("visible_on", convertDateToISO(now));
        }
        if (!hiddenOn) {
          const twoHoursLater = new Date();
          twoHoursLater.setHours(twoHoursLater.getHours() + 2);
          setValue("hidden_on", convertDateToISO(twoHoursLater));
        }
        break;
    }
  };

  return (
    <div className={styles.formField}>
      <label>Visibility</label>
      <div className="flex flex-column gap-3">
        <div className="flex flex-column gap-2">
          <div className="flex align-items-center">
            <RadioButton
              inputId="visibility-hidden"
              value="hidden"
              checked={visibilityMode === "hidden"}
              onChange={() => handleModeChange("hidden")}
            />
            <label htmlFor="visibility-hidden" className="ml-2 cursor-pointer">
              Hidden
            </label>
          </div>

          <div className="flex align-items-center">
            <RadioButton
              inputId="visibility-visible"
              value="visible"
              checked={visibilityMode === "visible"}
              onChange={() => handleModeChange("visible")}
            />
            <label htmlFor="visibility-visible" className="ml-2 cursor-pointer">
              Visible
            </label>
          </div>

          <div className="flex flex-column gap-2">
            <div className="flex align-items-center">
              <RadioButton
                inputId="visibility-scheduled-visible"
                value="scheduled_visible"
                checked={visibilityMode === "scheduled_visible"}
                onChange={() => handleModeChange("scheduled_visible")}
              />
              <label htmlFor="visibility-scheduled-visible" className="ml-2 cursor-pointer">
                Scheduled: Make visible on
              </label>
            </div>
            {visibilityMode === "scheduled_visible" && (
              <Controller
                name="visible_on"
                control={control}
                render={({ field: dateField }) => (
                  <DateTimePicker
                    value={dateField.value}
                    onChange={(val) => dateField.onChange(val)}
                    utc
                  />
                )}
              />
            )}

            <div className="flex align-items-center">
              <RadioButton
                inputId="visibility-scheduled-hidden"
                value="scheduled_hidden"
                checked={visibilityMode === "scheduled_hidden"}
                onChange={() => handleModeChange("scheduled_hidden")}
              />
              <label htmlFor="visibility-scheduled-hidden" className="ml-2 cursor-pointer">
                Scheduled: Hide on
              </label>
            </div>
            {visibilityMode === "scheduled_hidden" && (
              <Controller
                name="hidden_on"
                control={control}
                render={({ field: dateField }) => (
                  <DateTimePicker
                    value={dateField.value}
                    onChange={(val) => dateField.onChange(val)}
                    utc
                  />
                )}
              />
            )}

            <div className="flex align-items-center">
              <RadioButton
                inputId="visibility-scheduled-period"
                value="scheduled_period"
                checked={visibilityMode === "scheduled_period"}
                onChange={() => handleModeChange("scheduled_period")}
              />
              <label htmlFor="visibility-scheduled-period" className="ml-2 cursor-pointer">
                Scheduled: Visible during period
              </label>
            </div>
            {visibilityMode === "scheduled_period" && (
              <div className="flex flex-column gap-2 ml-4">
                <div>
                  <label className="block mb-1 text-sm">Visible from:</label>
                  <Controller
                    name="visible_on"
                    control={control}
                    render={({ field: dateField }) => (
                      <DateTimePicker
                        value={dateField.value}
                        onChange={(val) => dateField.onChange(val)}
                        utc
                      />
                    )}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm">Hidden after:</label>
                  <Controller
                    name="hidden_on"
                    control={control}
                    render={({ field: dateField }) => (
                      <DateTimePicker
                        value={dateField.value}
                        onChange={(val) => dateField.onChange(val)}
                        utc
                      />
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <small className="text-gray-600 mt-2 block">
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
      </small>
    </div>
  );
};
