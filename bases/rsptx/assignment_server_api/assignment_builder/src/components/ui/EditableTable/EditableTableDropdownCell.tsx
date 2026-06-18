import { Select } from "@mantine/core";
import { useState } from "react";

import { useTableDropdownOptions } from "@/hooks/useTableDropdownOptions";
import {
  DraggingExerciseDropdownColumns,
  EDITABLE_FIELD_LABELS,
  EditableCellProps
} from "@/types/components/editableTableCell";

import styles from "./EditableTableCellControl.module.css";

export const EditableTableDropdownCell = ({
  handleChange,
  value,
  fieldName,
  hideDragIcon,
  questionType,
  itemId,
  rowLabel
}: EditableCellProps<DraggingExerciseDropdownColumns>) => {
  const [dropdownValue, setDropdownValue] = useState<string | null>((value as string) ?? null);
  const { [fieldName]: options } = useTableDropdownOptions(questionType);
  const data = options.map((option) => ({ value: option.value, label: option.label }));

  const onChange = (next: string | null) => {
    if (next === null) {
      return;
    }
    setDropdownValue(next);
    handleChange(itemId, fieldName, next);
  };

  return (
    <Select
      classNames={{
        root: styles.controlRoot,
        wrapper: styles.controlWrapper,
        input: styles.control
      }}
      variant="unstyled"
      id={`${fieldName}-${itemId}`}
      name={`${fieldName}-${itemId}`}
      aria-label={`${EDITABLE_FIELD_LABELS[fieldName]} for ${rowLabel ?? `row ${itemId}`}`}
      value={dropdownValue}
      onChange={onChange}
      data={data}
      allowDeselect={false}
      comboboxProps={{ withinPortal: true }}
      onDropdownClose={hideDragIcon}
    />
  );
};
