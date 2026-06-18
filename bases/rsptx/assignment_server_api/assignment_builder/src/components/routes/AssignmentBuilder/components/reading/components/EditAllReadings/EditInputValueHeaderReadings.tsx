import { withEditAllReadings } from "@components/routes/AssignmentBuilder/components/reading/components/EditAllReadings/withEditAllReadings";
import { NumberInput } from "@mantine/core";

import {
  DraggingExerciseNumberColumns,
  EDITABLE_FIELD_LABELS
} from "@/types/components/editableTableCell";

export interface EditInputValueHeaderReadingsComponentProps {
  value: number;
  onChange: (v: number) => void;
  field: DraggingExerciseNumberColumns;
}

const EditInputValueHeaderReadingsComponent = ({
  value,
  onChange,
  field
}: EditInputValueHeaderReadingsComponentProps) => {
  return (
    <NumberInput
      w="100%"
      id={field}
      name={field}
      aria-label={`${EDITABLE_FIELD_LABELS[field]} for all readings`}
      min={0}
      max={100}
      value={value}
      onChange={(next) => onChange(typeof next === "number" ? next : 0)}
    />
  );
};

export const EditInputValueHeaderReadings =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withEditAllReadings<number, any>(EditInputValueHeaderReadingsComponent);
