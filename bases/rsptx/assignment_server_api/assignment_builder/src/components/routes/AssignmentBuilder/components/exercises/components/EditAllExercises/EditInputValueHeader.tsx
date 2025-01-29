import { withEditAllExercises } from "@components/routes/AssignmentBuilder/components/exercises/components/EditAllExercises/withEditAllExercises";
import { InputNumber } from "primereact/inputnumber";
import { KeyboardEvent } from "react";

import { DraggingExerciseNumberColumns } from "@/types/components/editableTableCell";

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
    <InputNumber
      style={{ width: "100%" }}
      id={field}
      name={field}
      min={0}
      value={value}
      onChange={(e) => onChange(e.value ?? 0)}
      onKeyDown={handleKeyDown}
    />
  );
};

export const EditInputValueHeader = withEditAllExercises<number, any>(
  EditInputValueHeaderComponent
);
