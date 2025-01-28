import { withEditAllExercises } from "@components/routes/AssignmentBuilder/components/exercises/components/EditAllExercises/withEditAllExercises";
import { Dropdown } from "primereact/dropdown";
import { useEffect } from "react";

import { useTableDropdownOptions } from "@/hooks/useTableDropdownOptions";
import { DraggingExerciseDropdownColumns } from "@/types/components/editableTableCell";

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

export const EditDropdownValueHeader = withEditAllExercises<string, any>(
  EditDropdownValueHeaderComponent
);
