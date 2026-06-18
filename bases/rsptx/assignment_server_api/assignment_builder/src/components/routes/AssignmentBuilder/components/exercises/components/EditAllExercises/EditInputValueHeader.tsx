import { withEditAllExercises } from "@components/routes/AssignmentBuilder/components/exercises/components/EditAllExercises/withEditAllExercises";
import { NumberInput } from "@mantine/core";
import { KeyboardEvent } from "react";

import {
  DraggingExerciseNumberColumns,
  EDITABLE_FIELD_LABELS
} from "@/types/components/editableTableCell";

export interface EditInputValueHeaderComponentProps {
  value: number;
  onChange: (v: number) => void;
  handleSubmit: () => Promise<void>;
  field: DraggingExerciseNumberColumns;
}

const EditInputValueHeaderComponent = ({
  value,
  onChange,
  handleSubmit,
  field
}: EditInputValueHeaderComponentProps) => {
  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      await handleSubmit();
    }
  };

  return (
    <NumberInput
      w="100%"
      id={field}
      name={field}
      aria-label={`${EDITABLE_FIELD_LABELS[field]} for all exercises`}
      min={0}
      value={value}
      onChange={(next) => onChange(typeof next === "number" ? next : 0)}
      onKeyDown={handleKeyDown}
    />
  );
};

export const EditInputValueHeader = withEditAllExercises<
  number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>(EditInputValueHeaderComponent);
