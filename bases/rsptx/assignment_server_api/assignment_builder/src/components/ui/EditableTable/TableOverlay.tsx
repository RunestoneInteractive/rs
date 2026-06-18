import { notify } from "@components/ui/notify";
import { useUpdateAssignmentQuestionsMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { FC, useCallback, useEffect, useState } from "react";

import { Nullable } from "@/types/common";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

import styles from "./TableOverlay.module.css";

export type OverlayType = "exercises" | "readings";

const OVERLAY_NOUNS: Record<OverlayType, { singular: string; plural: string }> = {
  exercises: { singular: "exercise", plural: "exercises" },
  readings: { singular: "reading", plural: "readings" }
};

export const getRangeUpdateToastCopy = (type: OverlayType, count: number) => {
  const noun = OVERLAY_NOUNS[type];

  return {
    success: `Updated ${count} ${count === 1 ? noun.singular : noun.plural}`,
    error: `Couldn't update ${noun.plural}. Try again.`
  };
};

interface TableSelectionOverlayProps {
  startItemId: Nullable<number>;
  draggingFieldName: Nullable<DraggingExerciseColumns>;
  containerEl: HTMLElement | null;
  handleMouseUp: VoidFunction;
  type: OverlayType;
  exercises: Exercise[];
}

const getRowElements = (containerEl: HTMLElement | null): HTMLElement[] => {
  if (!containerEl) {
    return [];
  }
  return Array.from(containerEl.querySelectorAll<HTMLElement>("tbody tr[data-item-id]"));
};

const getRowId = (rowElement: HTMLElement): number | null => {
  const raw = rowElement.dataset.itemId;

  return raw ? Number(raw) : null;
};

export const TableSelectionOverlay: FC<TableSelectionOverlayProps> = ({
  startItemId,
  draggingFieldName,
  handleMouseUp,
  containerEl,
  type,
  exercises
}) => {
  const [updateExercises] = useUpdateAssignmentQuestionsMutation();
  const [endItemId, setEndItemId] = useState<Nullable<number>>(null);

  useEffect(() => {
    setEndItemId(startItemId);
  }, [startItemId]);

  const getSelectedItemIds = useCallback((): number[] => {
    if (startItemId === null || endItemId === null) {
      return [];
    }
    const rows = getRowElements(containerEl);
    const ids = rows.map(getRowId);
    const startIndex = ids.indexOf(startItemId);
    const endIndex = ids.indexOf(endItemId);

    if (startIndex === -1 || endIndex === -1) {
      return startItemId !== null ? [startItemId] : [];
    }
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    return ids.slice(minIndex, maxIndex + 1).filter((id): id is number => id !== null);
  }, [containerEl, startItemId, endItemId]);

  const handleMouseUpEvent = useCallback(
    async (event: MouseEvent) => {
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
          const copy = getRangeUpdateToastCopy(type, itemsToUpdate.length);

          if (!error) {
            notify.success(copy.success);
          } else {
            notify.error(copy.error);
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
      startItemId,
      updateExercises,
      type,
      getSelectedItemIds
    ]
  );

  useEffect(() => {
    if (!draggingFieldName) {
      return;
    }
    const preventScroll = (event: WheelEvent) => event.preventDefault();

    window.addEventListener("wheel", preventScroll, { passive: false });
    return () => window.removeEventListener("wheel", preventScroll);
  }, [draggingFieldName]);

  useEffect(() => {
    if (!containerEl || startItemId === null) {
      return;
    }
    const containerRect = containerEl.getBoundingClientRect();
    const isRowVisible = (row: HTMLElement) => {
      const rowRect = row.getBoundingClientRect();

      return rowRect.top >= containerRect.top && rowRect.bottom <= containerRect.bottom;
    };

    const rows = getRowElements(containerEl);
    const handlers = rows.map((rowElement) => {
      const handleMouseEnter = () => {
        if (isRowVisible(rowElement)) {
          const id = getRowId(rowElement);

          if (id !== null) {
            setEndItemId(id);
          }
        }
      };

      rowElement.addEventListener("mouseenter", handleMouseEnter);
      return { rowElement, handleMouseEnter };
    });

    window.addEventListener("mouseup", handleMouseUpEvent);

    return () => {
      window.removeEventListener("mouseup", handleMouseUpEvent);
      handlers.forEach(({ rowElement, handleMouseEnter }) =>
        rowElement.removeEventListener("mouseenter", handleMouseEnter)
      );
    };
  }, [handleMouseUpEvent, startItemId, containerEl, exercises]);

  if (startItemId === null || endItemId === null || !draggingFieldName || !containerEl) {
    return null;
  }

  const rows = getRowElements(containerEl);
  const ids = rows.map(getRowId);
  const startIndex = ids.indexOf(startItemId);
  const endIndex = ids.indexOf(endItemId);

  if (startIndex === -1 || endIndex === -1) {
    return null;
  }
  const minIndex = Math.min(startIndex, endIndex);
  const maxIndex = Math.max(startIndex, endIndex);

  const topCell = rows[minIndex].querySelector<HTMLElement>(
    `td[data-field="${draggingFieldName}"]`
  );
  const bottomCell = rows[maxIndex].querySelector<HTMLElement>(
    `td[data-field="${draggingFieldName}"]`
  );

  if (!topCell || !bottomCell) {
    return null;
  }
  const containerRect = containerEl.getBoundingClientRect();
  const topRect = topCell.getBoundingClientRect();
  const bottomRect = bottomCell.getBoundingClientRect();

  return (
    <div
      className={styles.overlay}
      style={{
        top: topRect.top - containerRect.top + containerEl.scrollTop,
        left: topRect.left - containerRect.left + containerEl.scrollLeft,
        width: topRect.width,
        height: bottomRect.bottom - topRect.top
      }}
    />
  );
};
