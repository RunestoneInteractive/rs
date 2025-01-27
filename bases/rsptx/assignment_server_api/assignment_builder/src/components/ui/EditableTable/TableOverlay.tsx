import { useToastContext } from "@components/ui/ToastContext";
import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { DataTable } from "primereact/datatable";
import { FC, useCallback, useEffect, useState } from "react";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Nullable } from "@/types/common";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

interface TableSelectionOverlayProps {
  startRowIndex: Nullable<number>;
  draggingFieldName: Nullable<DraggingExerciseColumns>;
  tableRef: DataTable<Exercise[]>;
  handleMouseUp: VoidFunction;
}

export const TableSelectionOverlay: FC<TableSelectionOverlayProps> = ({
  startRowIndex,
  draggingFieldName,
  handleMouseUp,
  tableRef
}) => {
  const { showToast } = useToastContext();
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const { assignmentExercises = [] } = useExercisesSelector();
  const [endRowIndex, setEndRowIndex] = useState<Nullable<number>>(null);

  const handleMouseUpEvent = useCallback(
    async (event: any) => {
      event.stopPropagation();
      event.preventDefault();
      if (draggingFieldName !== null && startRowIndex !== null && endRowIndex !== null) {
        const min = Math.min(startRowIndex, endRowIndex);
        const max = Math.max(startRowIndex, endRowIndex);
        const draggingValue = assignmentExercises[startRowIndex][draggingFieldName];

        const exToUpdate = [];

        for (let i = min; i <= max; i++) {
          if (
            assignmentExercises[i][draggingFieldName] !==
            assignmentExercises[startRowIndex][draggingFieldName]
          ) {
            exToUpdate.push({
              ...assignmentExercises[i],
              [draggingFieldName]: draggingValue
            });
          }
        }

        if (!!exToUpdate.length) {
          const { error } = await updateExercises(exToUpdate);

          if (!error) {
            showToast({
              severity: "success",
              summary: "Success",
              detail: "Exercises updated successfully"
            });
          } else {
            showToast({
              severity: "error",
              summary: "Error",
              detail: "Failed to update exercises"
            });
          }
        }
      }
      handleMouseUp();
      setEndRowIndex(null);
    },
    [
      assignmentExercises,
      draggingFieldName,
      endRowIndex,
      handleMouseUp,
      showToast,
      startRowIndex,
      updateExercises
    ]
  );

  useEffect(() => {
    setEndRowIndex(startRowIndex);
  }, [startRowIndex]);

  useEffect(() => {
    const preventScroll = (event: WheelEvent) => {
      event.preventDefault();
    };

    if (draggingFieldName) {
      window.addEventListener("wheel", preventScroll, { passive: false });
    } else {
      window.removeEventListener("wheel", preventScroll);
    }

    return () => {
      window.removeEventListener("wheel", preventScroll);
    };
  }, [draggingFieldName]);

  useEffect(() => {
    if (!tableRef) {
      return;
    }

    const [_, ...rows] = tableRef.getTable().rows;

    const rowEventHandlers: Array<(event: Event) => void> = [];

    window.addEventListener("mouseup", handleMouseUpEvent);

    const tableRect = tableRef.getTable().getBoundingClientRect();
    const isRowVisible = (row: HTMLElement) => {
      const rowRect = row.getBoundingClientRect();

      return (
        rowRect.bottom > tableRect.top && rowRect.top < tableRect.bottom // Проверяем, пересекается ли строка с видимой областью таблицы
      );
    };

    Array.from(rows).forEach((row, index) => {
      const handleMouseEnter = () => {
        if (startRowIndex !== null && isRowVisible(row)) {
          setEndRowIndex(index);
        }
      };

      row.addEventListener("mouseenter", handleMouseEnter);

      rowEventHandlers.push(handleMouseEnter);
    });

    return () => {
      window.removeEventListener("mouseup", handleMouseUpEvent);

      Array.from(rows).forEach((row, index) => {
        const handler = rowEventHandlers[index];

        if (handler && !!row) {
          row.removeEventListener("mouseenter", handler);
        }
      });
    };
  }, [handleMouseUp, handleMouseUpEvent, startRowIndex, tableRef]);

  if (startRowIndex === null || endRowIndex === null || !draggingFieldName || !tableRef) {
    return null;
  }

  const table = tableRef.getTable();

  const [_, ...rows] = table.rows;

  const columnIndex = Array.from(rows[0].children).findIndex(
    (cell) => !!cell.querySelector(`#${draggingFieldName}`)
  );

  if (columnIndex === -1) return null;

  const topRow = rows[Math.min(startRowIndex, endRowIndex)] as HTMLElement;
  const bottomRow = rows[Math.max(startRowIndex, endRowIndex)] as HTMLElement;

  const topCell = topRow.children[columnIndex] as HTMLElement;
  const bottomCell = bottomRow.children[columnIndex] as HTMLElement;

  const { top, left } = topCell.getBoundingClientRect();

  return (
    <div
      className="table-overlay"
      style={{
        position: "absolute",
        top: top + window.scrollY,
        left: left + window.scrollX,
        width: topCell.offsetWidth,
        height: bottomCell.offsetTop + bottomCell.offsetHeight - topCell.offsetTop,
        border: "2px solid var(--primary-color)",
        pointerEvents: "none",
        zIndex: 10
      }}
    />
  );
};
