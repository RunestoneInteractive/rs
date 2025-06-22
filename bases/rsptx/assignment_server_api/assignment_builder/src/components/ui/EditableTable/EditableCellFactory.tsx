import { EditableTableDropdownCell } from "@components/ui/EditableTable/EditableTableDropdownCell";
import { EditableTableInputNumberCell } from "@components/ui/EditableTable/EditableTableInputCell";
import { withCellRangeSelector } from "@components/ui/EditableTable/hoc/WithCellRangeSelector";
import { FC, memo } from "react";

import {
  DraggingExerciseDropdownColumns,
  DraggingExerciseNumberColumns,
  EditableCellFactoryProps,
  isDropdownField,
  isNumberField
} from "@/types/components/editableTableCell";

export const EditableCellFactory: FC<EditableCellFactoryProps> = memo(
  ({ fieldName, itemId, handleMouseDown, handleChange, value, questionType, isDragging }) => {
    const WrappedCell = withCellRangeSelector((props) => {
      if (isDropdownField(fieldName)) {
        return (
          <EditableTableDropdownCell
            {...props}
            fieldName={fieldName as DraggingExerciseDropdownColumns}
            value={value as string}
          />
        );
      }

      if (isNumberField(fieldName)) {
        return (
          <EditableTableInputNumberCell
            {...props}
            fieldName={fieldName as DraggingExerciseNumberColumns}
            value={value as number}
          />
        );
      }

      return <div>No config for this type of field</div>;
    });

    return (
      <WrappedCell
        fieldName={fieldName}
        itemId={itemId}
        handleMouseDown={handleMouseDown}
        handleChange={handleChange}
        value={value}
        questionType={questionType}
        isDragging={isDragging}
      />
    );
  },
  (prevProps, nextProps) => {
    return (
      JSON.stringify(prevProps) === JSON.stringify(nextProps) &&
      prevProps.handleChange === nextProps.handleChange
    );
  }
);
