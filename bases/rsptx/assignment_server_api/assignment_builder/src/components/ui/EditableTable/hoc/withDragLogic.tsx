import { ComponentType, useState } from "react";

import { useUpdateExercises } from "@/hooks/useUpdateExercises";
import { Nullable } from "@/types/common";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";

export interface WithDragLogicProps {
  startRowIndex: Nullable<number>;
  draggingFieldName: Nullable<DraggingExerciseColumns>;
  handleMouseDown: (rowIndex: number, colKey: DraggingExerciseColumns) => void;
  handleMouseUp: () => void;
  handleChange: (
    rowIndex: number,
    fieldName: DraggingExerciseColumns,
    value: string | number
  ) => void;
}

export function withDragLogic<P extends WithDragLogicProps>(Component: ComponentType<P>) {
  return function WrappedComponent(props: Omit<P, keyof WithDragLogicProps>) {
    const { handleChange } = useUpdateExercises();
    const [startRowIndex, setStartRowIndex] = useState<Nullable<number>>(null);
    const [draggingFieldName, setDraggingFieldName] =
      useState<Nullable<DraggingExerciseColumns>>(null);

    const handleMouseDown = (rowIndex: number, colKey: DraggingExerciseColumns) => {
      setStartRowIndex(rowIndex);
      setDraggingFieldName(colKey);
    };

    const handleMouseUp = () => {
      setStartRowIndex(null);
      setDraggingFieldName(null);
    };

    return (
      <Component
        {...(props as P)}
        startRowIndex={startRowIndex}
        draggingFieldName={draggingFieldName}
        handleMouseDown={handleMouseDown}
        handleMouseUp={handleMouseUp}
        handleChange={handleChange}
      />
    );
  };
}
