import { useToastContext } from "@components/ui/ToastContext";
import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { DataTable } from "primereact/datatable";
import { FC, useCallback, useEffect, useState } from "react";

import { Nullable } from "@/types/common";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

type OverlayType = "exercises" | "readings";

interface TableSelectionOverlayProps {
  startItemId: Nullable<number>;
  draggingFieldName: Nullable<DraggingExerciseColumns>;
  tableRef: DataTable<Exercise[]>;
  handleMouseUp: VoidFunction;
  type: OverlayType;
  exercises: Exercise[];
}

export const TableSelectionOverlay: FC<TableSelectionOverlayProps> = ({
  startItemId,
  draggingFieldName,
  handleMouseUp,
  tableRef,
  type,
  exercises
}) => {
  const { showToast } = useToastContext();
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const [endItemId, setEndItemId] = useState<Nullable<number>>(null);

  // Configuration based on type
  const config = {
    exercises: {
      successMessage: "exercise(s)",
      errorMessage: "exercises",
      selector: 'input, select, [id^="autograde"], [id^="which_to_grade"], [id^="points"]'
    },
    readings: {
      successMessage: "reading(s)",
      errorMessage: "readings",
      selector:
        'input, select, [id^="which_to_grade"], [id^="points"], [id^="activities_required"]'
    }
  }[type];

  useEffect(() => {
    setEndItemId(startItemId);
  }, [startItemId]);

  const handleMouseUpEvent = useCallback(
    async (event: any) => {
      event.stopPropagation();
      event.preventDefault();

      if (draggingFieldName && startItemId && endItemId !== null) {
        const startItem = exercises.find((ex) => ex.id === startItemId);

        if (!startItem) {
          console.error("Start item not found");
          handleMouseUp();
          return;
        }

        const sourceValue = startItem[draggingFieldName];

        const selectedItemIds = getSelectedItemIds();
        const itemsToUpdate: Exercise[] = [];

        for (const itemId of selectedItemIds) {
          const item = exercises.find((ex) => ex.id === itemId);

          if (item && item[draggingFieldName] !== sourceValue) {
            itemsToUpdate.push({
              ...item,
              question_json: JSON.stringify(item.question_json),
              [draggingFieldName]: sourceValue
            });
          }
        }

        if (itemsToUpdate.length > 0) {
          const { error } = await updateExercises(itemsToUpdate);

          if (!error) {
            showToast({
              severity: "success",
              summary: "Success",
              detail: `Updated ${itemsToUpdate.length} ${config.successMessage} successfully`
            });
          } else {
            showToast({
              severity: "error",
              summary: "Error",
              detail: `Failed to update ${config.errorMessage}`
            });
          }
        }
      }

      handleMouseUp();
      setEndItemId(null);
    },
    [
      exercises,
      draggingFieldName,
      endItemId,
      handleMouseUp,
      showToast,
      startItemId,
      updateExercises,
      config
    ]
  );

  const getSelectedItemIds = useCallback((): number[] => {
    if (!tableRef || startItemId === null || endItemId === null) {
      return [];
    }

    const table = tableRef.getTable();

    if (!table) return [];

    const [_, ...rows] = table.rows;
    const itemIds: number[] = [];

    let startRowElement: HTMLElement | null = null;
    let endRowElement: HTMLElement | null = null;

    for (const row of rows) {
      const rowElement = row as HTMLElement;
      const rowData = getRowDataFromElement(rowElement);

      if (rowData?.id === startItemId) {
        startRowElement = rowElement;
      }
      if (rowData?.id === endItemId) {
        endRowElement = rowElement;
      }
    }

    if (!startRowElement || !endRowElement) {
      return startItemId ? [startItemId] : [];
    }

    // Get all rows between start and end (inclusive)
    const startIndex = Array.from(rows).indexOf(startRowElement as HTMLTableRowElement);
    const endIndex = Array.from(rows).indexOf(endRowElement as HTMLTableRowElement);

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    for (let i = minIndex; i <= maxIndex; i++) {
      const row = rows[i] as HTMLElement;
      const rowData = getRowDataFromElement(row);

      if (rowData?.id) {
        itemIds.push(rowData.id);
      }
    }

    return itemIds;
  }, [tableRef, startItemId, endItemId]);

  const getRowDataFromElement = useCallback(
    (rowElement: HTMLElement): Exercise | null => {
      const inputs = rowElement.querySelectorAll(config.selector);

      for (const input of inputs) {
        const element = input as HTMLElement;
        const name = element.getAttribute("name") || element.id;

        if (name) {
          const match = name.match(/-(\d+)$/);

          if (match) {
            const itemId = parseInt(match[1]);
            const currentTableData = tableRef?.props.value || [];

            return currentTableData.find((item: Exercise) => item.id === itemId) || null;
          }
        }
      }

      return null;
    },
    [tableRef, config.selector]
  );

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
    if (!tableRef || startItemId === null) {
      return;
    }

    const table = tableRef.getTable();

    if (!table) return;

    const [_, ...rows] = table.rows;
    const rowEventHandlers: Array<(event: Event) => void> = [];

    window.addEventListener("mouseup", handleMouseUpEvent);

    const tableRect = tableRef.getElement().getBoundingClientRect();
    const isRowVisible = (row: HTMLElement) => {
      const rowRect = row.getBoundingClientRect();

      return rowRect.top > tableRect.top && rowRect.bottom < tableRect.bottom;
    };

    Array.from(rows).forEach((row) => {
      const rowElement = row as HTMLElement;

      const handleMouseEnter = () => {
        if (startItemId !== null && isRowVisible(rowElement)) {
          const rowData = getRowDataFromElement(rowElement);

          if (rowData?.id) {
            setEndItemId(rowData.id);
          }
        }
      };

      rowElement.addEventListener("mouseenter", handleMouseEnter);
      rowEventHandlers.push(handleMouseEnter);
    });

    return () => {
      window.removeEventListener("mouseup", handleMouseUpEvent);

      Array.from(rows).forEach((row, index) => {
        const handler = rowEventHandlers[index];

        if (handler && row) {
          row.removeEventListener("mouseenter", handler);
        }
      });
    };
  }, [handleMouseUpEvent, startItemId, tableRef, getRowDataFromElement]);

  if (startItemId === null || endItemId === null || !draggingFieldName || !tableRef) {
    return null;
  }

  const table = tableRef.getTable();

  if (!table) return null;

  const [_, ...rows] = table.rows;

  if (rows.length === 0) return null;

  let startRowElement: HTMLElement | null = null;
  let endRowElement: HTMLElement | null = null;

  for (const row of rows) {
    const rowElement = row as HTMLElement;
    const rowData = getRowDataFromElement(rowElement);

    if (rowData?.id === startItemId) {
      startRowElement = rowElement;
    }
    if (rowData?.id === endItemId) {
      endRowElement = rowElement;
    }
  }

  if (!startRowElement || !endRowElement) {
    return null;
  }

  const firstRow = rows[0];
  const columnIndex = Array.from(firstRow.children).findIndex(
    (cell) => !!cell.querySelector(`#${draggingFieldName}`)
  );

  if (columnIndex === -1) return null;

  const startIndex = Array.from(rows).indexOf(startRowElement as HTMLTableRowElement);
  const endIndex = Array.from(rows).indexOf(endRowElement as HTMLTableRowElement);

  const minIndex = Math.min(startIndex, endIndex);
  const maxIndex = Math.max(startIndex, endIndex);

  const topRow = rows[minIndex] as HTMLElement;
  const bottomRow = rows[maxIndex] as HTMLElement;

  const topCell = topRow.children[columnIndex] as HTMLElement;
  const bottomCell = bottomRow.children[columnIndex] as HTMLElement;

  if (!topCell || !bottomCell) return null;

  const tableRect = tableRef.getElement().getBoundingClientRect();
  const { top, left } = topCell.getBoundingClientRect();

  return (
    <div
      className="table-overlay"
      style={{
        position: "absolute",
        top: top - tableRect.top + window.scrollY,
        left: left - tableRect.left + window.scrollX,
        width: topCell.offsetWidth,
        height: bottomCell.offsetTop + bottomCell.offsetHeight - topCell.offsetTop,
        border: "2px solid var(--primary-color)",
        backgroundColor: "rgba(var(--primary-color-rgb), 0.1)",
        pointerEvents: "none",
        zIndex: 10
      }}
    />
  );
};
