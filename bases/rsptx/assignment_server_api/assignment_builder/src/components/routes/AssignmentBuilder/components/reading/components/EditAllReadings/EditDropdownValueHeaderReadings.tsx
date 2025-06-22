import { withEditAllReadings } from "@components/routes/AssignmentBuilder/components/reading/components/EditAllReadings/withEditAllReadings";
import { Dropdown } from "primereact/dropdown";
import { useEffect } from "react";

import { useTableDropdownOptions } from "@/hooks/useTableDropdownOptions";
import { DraggingExerciseDropdownColumns } from "@/types/components/editableTableCell";

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

  useEffect(() => {
    if (options.length && !value.length) {
      onChange(options[0].value);
    }
  }, [onChange, options, value.length]);

  return (
    <Dropdown
      style={{ width: "100%" }}
      id={field}
      name={field}
      value={value}
      onChange={(e) => onChange(e.value)}
      options={options}
      optionLabel="label"
    />
  );
};

export const EditDropdownValueHeaderReadings = withEditAllReadings<string, any>(
  EditDropdownValueHeaderReadingsComponent
);
