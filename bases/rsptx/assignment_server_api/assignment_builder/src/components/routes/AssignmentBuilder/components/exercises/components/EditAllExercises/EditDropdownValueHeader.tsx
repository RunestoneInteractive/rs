import { withEditAllExercises } from "@components/routes/AssignmentBuilder/components/exercises/components/EditAllExercises/withEditAllExercises";
import { Select } from "@mantine/core";
import { useEffect } from "react";

import { useTableDropdownOptions } from "@/hooks/useTableDropdownOptions";
import {
  DraggingExerciseDropdownColumns,
  EDITABLE_FIELD_LABELS
} from "@/types/components/editableTableCell";

export interface EditDropdownValueHeaderComponentProps {
  value: string;
  onChange: (v: string) => void;
  field: DraggingExerciseDropdownColumns;
}

const EditDropdownValueHeaderComponent = ({
  value,
  onChange,
  field
}: EditDropdownValueHeaderComponentProps) => {
  const { [field]: options } = useTableDropdownOptions();
  const data = options.map((option) => ({ value: option.value, label: option.label }));

  useEffect(() => {
    if (options.length && !value.length) {
      onChange(options[0].value);
    }
  }, [onChange, options, value.length]);

  return (
    <Select
      w="100%"
      id={field}
      name={field}
      aria-label={`${EDITABLE_FIELD_LABELS[field]} for all exercises`}
      value={value}
      onChange={(next) => onChange(next ?? "")}
      data={data}
      allowDeselect={false}
      comboboxProps={{ withinPortal: false }}
    />
  );
};

export const EditDropdownValueHeader = withEditAllExercises<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>(EditDropdownValueHeaderComponent);
