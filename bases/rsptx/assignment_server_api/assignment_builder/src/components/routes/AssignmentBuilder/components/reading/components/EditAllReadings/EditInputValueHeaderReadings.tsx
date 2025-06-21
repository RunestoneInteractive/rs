import { withEditAllReadings } from "@components/routes/AssignmentBuilder/components/reading/components/EditAllReadings/withEditAllReadings";
import { InputNumber } from "primereact/inputnumber";

import { DraggingExerciseNumberColumns } from "@/types/components/editableTableCell";

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
    <InputNumber
      style={{ width: "100%" }}
      id={field}
      name={field}
      value={value}
      onValueChange={(e) => onChange(e.value ?? 0)}
      showButtons={false}
      min={0}
      max={100}
    />
  );
};

export const EditInputValueHeaderReadings = withEditAllReadings<number, any>(
  EditInputValueHeaderReadingsComponent
);
