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
  itemId
}: EditableCellProps<DraggingExerciseDropdownColumns>) => {
  const [dropdownValue, setDropdownValue] = useState(value);
  const { [fieldName]: options } = useTableDropdownOptions(questionType);

  const onChange = (event: DropdownChangeEvent) => {
    setDropdownValue(event.value);
    handleChange(itemId, fieldName, event.value);
  };

  return (
    <Dropdown
      className="editable-table-dropdown"
      id={fieldName}
      name={`${fieldName}-${itemId}`}
      value={dropdownValue}
      onChange={onChange}
      options={options}
      optionLabel="label"
      scrollHeight="auto"
      onHide={hideDragIcon}
    />
  );
};
