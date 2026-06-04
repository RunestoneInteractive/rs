import { notify } from "@components/ui/notify";
import { NumberInput } from "@mantine/core";
import { useState } from "react";

import { Exercise } from "@/types/exercises";

import styles from "./ActivitiesRequiredCell.module.css";

interface ActivitiesRequiredCellProps {
  value: number;
  exercise: Exercise;
  onUpdate: (itemId: number, fieldName: string, value: number) => void;
  itemId: number;
}

const MIN_ACTIVITIES = 1;

export const ActivitiesRequiredCell = ({
  value,
  exercise,
  onUpdate,
  itemId
}: ActivitiesRequiredCellProps) => {
  const [currentValue, setCurrentValue] = useState<number | string>(value || MIN_ACTIVITIES);

  const handleValueChange = (next: number | string) => {
    const numValue = typeof next === "number" ? next : parseInt(next, 10) || MIN_ACTIVITIES;
    const activityCount = Math.max(exercise.numQuestions ?? 0, MIN_ACTIVITIES);

    if (numValue > activityCount) {
      notify.error({
        title: "Too many required activities",
        message: `Required activities (${numValue}) can't exceed the activity count (${activityCount}).`
      });

      setCurrentValue(value || MIN_ACTIVITIES);
      return;
    }

    setCurrentValue(numValue);
    onUpdate(itemId, "activities_required", numValue);
  };

  return (
    <NumberInput
      classNames={{ root: styles.root, wrapper: styles.wrapper, input: styles.control }}
      variant="unstyled"
      hideControls
      aria-label={`Required activities for ${exercise.name || exercise.title}`}
      min={MIN_ACTIVITIES}
      max={Math.max(exercise.numQuestions ?? 0, MIN_ACTIVITIES)}
      value={currentValue}
      onChange={handleValueChange}
    />
  );
};
