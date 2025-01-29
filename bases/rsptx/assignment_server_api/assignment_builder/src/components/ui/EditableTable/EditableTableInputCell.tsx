import { InputNumber } from "primereact/inputnumber";
import { useState, useEffect, KeyboardEvent } from "react";

import {
  DraggingExerciseNumberColumns,
  EditableCellProps
} from "@/types/components/editableTableCell";

export const EditableTableInputNumberCell = ({
  handleChange,
  value,
  fieldName,
  rowIndex
}: EditableCellProps<DraggingExerciseNumberColumns>) => {
  const [cellValue, setCellValue] = useState(value);

  useEffect(() => {
    setCellValue(value);
  }, [value]);

  const handleBlur = (updated: string) => {
    const updatedValue = parseInt(updated.replaceAll(",", ""));

    handleChange(rowIndex, fieldName, updatedValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <InputNumber
      className="editable-table-input"
      id={fieldName}
      name={`${fieldName}-${rowIndex}`}
      min={0}
      value={cellValue as number}
      onChange={(e) => setCellValue(e.value ?? 0)}
      onBlur={(e) => handleBlur(e.target.value)}
      onKeyDown={handleKeyDown}
      onSelectCapture={(e) => e.preventDefault()}
      onSelect={(e) => e.preventDefault()}
    />
  );
};
