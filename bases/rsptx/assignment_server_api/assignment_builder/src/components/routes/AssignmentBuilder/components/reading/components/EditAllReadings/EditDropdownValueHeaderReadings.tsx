import {
  withEditAllReadings,
  WithEditAllReadingsProps
} from "@components/routes/AssignmentBuilder/components/reading/components/EditAllReadings/withEditAllReadings";
import { Select } from "@mantine/core";
import { useEffect } from "react";

import { useTableDropdownOptions } from "@/hooks/useTableDropdownOptions";
import {
  DraggingExerciseDropdownColumns,
  EDITABLE_FIELD_LABELS
} from "@/types/components/editableTableCell";

export interface EditDropdownValueHeaderReadingsComponentProps {
  value: string;
  onChange: (v: string) => void;
  field: DraggingExerciseDropdownColumns;
}

const EditDropdownValueHeaderReadingsComponent = ({
  value,
  onChange,
  field
}: EditDropdownValueHeaderReadingsComponentProps) => {
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
      aria-label={`${EDITABLE_FIELD_LABELS[field]} for all readings`}
      value={value}
      onChange={(next) => onChange(next ?? "")}
      data={data}
      allowDeselect={false}
      comboboxProps={{ withinPortal: false }}
    />
  );
};

export const EditDropdownValueHeaderReadings = withEditAllReadings<
  string,
  EditDropdownValueHeaderReadingsComponentProps & WithEditAllReadingsProps<string>
>(EditDropdownValueHeaderReadingsComponent);
