import { NumberInput } from "@mantine/core";
import { useState, useEffect, KeyboardEvent } from "react";

import {
  DraggingExerciseNumberColumns,
  EDITABLE_FIELD_LABELS,
  EditableCellProps
} from "@/types/components/editableTableCell";

import styles from "./EditableTableCellControl.module.css";

export const EditableTableInputNumberCell = ({
  handleChange,
  value,
  fieldName,
  itemId,
  rowLabel
}: EditableCellProps<DraggingExerciseNumberColumns>) => {
  const [cellValue, setCellValue] = useState<number | string>(value);

  useEffect(() => {
    setCellValue(value);
  }, [value]);

  const commit = () => {
    const parsed = typeof cellValue === "number" ? cellValue : parseInt(String(cellValue), 10);

    handleChange(itemId, fieldName, Number.isNaN(parsed) ? 0 : parsed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <NumberInput
      classNames={{
        root: styles.controlRoot,
        wrapper: styles.controlWrapper,
        input: `${styles.control} ${styles.controlNumeric}`
      }}
      variant="unstyled"
      id={`${fieldName}-${itemId}`}
      name={`${fieldName}-${itemId}`}
      aria-label={`${EDITABLE_FIELD_LABELS[fieldName]} for ${rowLabel ?? `row ${itemId}`}`}
      min={0}
      hideControls
      value={cellValue}
      onChange={setCellValue}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  );
};
