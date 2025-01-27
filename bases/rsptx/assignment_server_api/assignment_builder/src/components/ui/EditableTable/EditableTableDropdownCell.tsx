import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";
import { useState } from "react";

import { useTableDropdownOptions } from "@/hooks/useTableDropdownOptions";
import {
  DraggingExerciseDropdownColumns,
  EditableCellProps
} from "@/types/components/editableTableCell";

export const EditableTableDropdownCell = ({
  handleChange,
  value,
  fieldName,
  hideDragIcon,
  questionType,
  rowIndex
}: EditableCellProps<DraggingExerciseDropdownColumns>) => {
  const [dropdownValue, setDropdownValue] = useState(value);
  const { [fieldName]: options } = useTableDropdownOptions(questionType);

  const onChange = (event: DropdownChangeEvent) => {
    setDropdownValue(event.value);
    handleChange(rowIndex, fieldName, event.value);
  };

  return (
    <Dropdown
      className="editable-table-dropdown"
      id={fieldName}
      name={`${fieldName}-${rowIndex}`}
      value={dropdownValue}
      onChange={onChange}
      options={options}
      optionLabel="label"
      onHide={hideDragIcon}
    />
  );
};
