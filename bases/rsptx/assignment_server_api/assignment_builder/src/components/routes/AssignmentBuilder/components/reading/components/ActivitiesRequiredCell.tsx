import { useToastContext } from "@components/ui/ToastContext";
import { InputNumber } from "primereact/inputnumber";
import { useState } from "react";

import { Exercise } from "@/types/exercises";

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
  const { showToast } = useToastContext();
  const [currentValue, setCurrentValue] = useState(value || MIN_ACTIVITIES);

  const handleValueChange = (newValue: number | null | undefined) => {
    const numValue = newValue ?? MIN_ACTIVITIES;
    const activityCount = exercise.numQuestions || MIN_ACTIVITIES;

    if (numValue > activityCount) {
      showToast({
        severity: "error",
        summary: "Invalid Value",
        detail: `# required (${numValue}) must not exceed the activity count (${activityCount}).`
      });

      setCurrentValue(value || MIN_ACTIVITIES);
      return;
    }

    setCurrentValue(numValue);
    onUpdate(itemId, "activities_required", numValue);
  };

  return (
    <InputNumber
      value={currentValue}
      onValueChange={(e) => handleValueChange(e.value)}
      min={MIN_ACTIVITIES}
      max={exercise.numQuestions || MIN_ACTIVITIES}
      showButtons={false}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        background: "transparent"
      }}
      inputStyle={{
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        background: "transparent",
        textAlign: "left",
        padding: "0.5rem",
        cursor: "text"
      }}
    />
  );
};
