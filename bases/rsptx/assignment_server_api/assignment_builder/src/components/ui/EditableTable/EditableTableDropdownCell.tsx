import { Dropdown, DropdownChangeEvent } from "primereact/dropdown";

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
  const { [fieldName]: options } = useTableDropdownOptions(questionType);

  const onChange = (event: DropdownChangeEvent) => {
    handleChange(rowIndex, fieldName, event.value);
  };

  return (
    <Dropdown
      className="editable-table-dropdown"
      id={fieldName}
      value={value}
      onChange={onChange}
      options={options}
      optionLabel="label"
      onHide={hideDragIcon}
    />
  );
};
