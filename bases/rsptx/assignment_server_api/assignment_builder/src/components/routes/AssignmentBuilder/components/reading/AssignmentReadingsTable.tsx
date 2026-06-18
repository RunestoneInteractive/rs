import { EditableCellFactory } from "@components/ui/EditableTable/EditableCellFactory";
import { EditableColumn, EditableDataTable } from "@components/ui/EditableTable/EditableDataTable";
import { TableSelectionOverlay } from "@components/ui/EditableTable/TableOverlay";
import { Icon } from "@components/ui/Icon";
import { useReorderAssignmentExercisesMutation } from "@store/assignmentExercise/assignmentExercise.logic.api";
import { RefCallback, useMemo, useState } from "react";

import { Nullable } from "@/types/common";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

import { ActivitiesRequiredCell } from "./components/ActivitiesRequiredCell";
import { EditInputValueHeaderReadings } from "./components/EditAllReadings/EditInputValueHeaderReadings";
import { MouseUpHandler } from "./types";

import styles from "./AssignmentReadingsTable.module.css";

interface AssignmentReadingsTableProps {
  assignmentReadings: Exercise[];
  selectedReadings: Exercise[];
  setSelectedReadings: (readings: Exercise[]) => void;
  globalFilter: string;
  startItemId: number | null;
  draggingFieldName: DraggingExerciseColumns | null;
  handleMouseDown: (itemId: number, fieldName: DraggingExerciseColumns) => void;
  handleMouseUp: MouseUpHandler;
  handleChange: (
    itemId: number,
    fieldName: DraggingExerciseColumns,
    value: string | number
  ) => void;
  scrollSentinelRef?: RefCallback<HTMLElement>;
}

const getNumQuestionsOrDefault = (numQuestions: Nullable<number>): number =>
  Math.max(numQuestions ?? 0, 1);

const matchesFilter = (reading: Exercise, filter: string): boolean => {
  const query = filter.trim().toLowerCase();

  if (!query) {
    return true;
  }
  return [reading.name, reading.title, reading.chapter, reading.subchapter]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(query));
};

export const AssignmentReadingsTable = ({
  assignmentReadings,
  selectedReadings,
  setSelectedReadings,
  globalFilter,
  startItemId,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange,
  scrollSentinelRef
}: AssignmentReadingsTableProps) => {
  const [reorderReadings] = useReorderAssignmentExercisesMutation();
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);

  const handleActivitiesRequiredUpdate = (itemId: number, fieldName: string, value: number) => {
    handleChange(itemId, fieldName as DraggingExerciseColumns, value);
  };

  const filteredReadings = useMemo(
    () => assignmentReadings.filter((reading) => matchesFilter(reading, globalFilter)),
    [assignmentReadings, globalFilter]
  );

  const columns = useMemo<EditableColumn<Exercise>[]>(
    () => [
      {
        key: "chapter",
        header: "Chapter",
        width: "12rem",
        render: (row) => <div className={styles.nowrap}>{row.chapter}</div>
      },
      {
        key: "subchapter",
        header: "Section",
        width: "20rem",
        render: (row) => (
          <div className={styles.sectionCell}>
            <div className={styles.sectionTitle} title={row.name || row.title}>
              {row.name || row.title}
            </div>
            <div className={styles.sectionPath} title={row.subchapter || undefined}>
              {row.subchapter}
            </div>
          </div>
        )
      },
      {
        key: "numQuestions",
        header: "Activities",
        width: "7rem",
        align: "right",
        render: (row) => (
          <span className="numeric">{getNumQuestionsOrDefault(row.numQuestions)}</span>
        )
      },
      {
        key: "activities_required",
        header: "Required",
        width: "7rem",
        align: "right",
        flushCell: true,
        render: (row) => (
          <ActivitiesRequiredCell
            value={
              row.activities_required ||
              Math.round(getNumQuestionsOrDefault(row.numQuestions) * 0.8)
            }
            exercise={row}
            onUpdate={handleActivitiesRequiredUpdate}
            itemId={row.id}
          />
        )
      },
      {
        key: "points",
        field: "points",
        width: "7rem",
        align: "right",
        header: <EditInputValueHeaderReadings field="points" label="Points" defaultValue={0} />,
        render: (row) => (
          <EditableCellFactory
            fieldName="points"
            itemId={row.id}
            handleMouseDown={handleMouseDown}
            handleChange={handleChange}
            value={row.points}
            questionType={row.question_type}
            isDragging={startItemId !== null}
            rowLabel={row.name || row.title}
          />
        )
      }
    ],
    [handleMouseDown, handleChange, startItemId]
  );

  return (
    <EditableDataTable
      data={filteredReadings}
      columns={columns}
      selection={selectedReadings}
      onSelectionChange={setSelectedReadings}
      onReorder={reorderReadings}
      ariaLabel="Assignment readings"
      getRowLabel={(row) => row.name || row.title || `row ${row.id}`}
      containerRef={setContainerEl}
      scrollSentinelRef={scrollSentinelRef}
      flush
      emptyMessage={
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <Icon name="book" size={22} />
          </div>
          <p className={styles.emptyTitle}>
            {globalFilter ? "No readings match your search" : "No readings yet"}
          </p>
          <p className={styles.emptyText}>
            {globalFilter
              ? "Try a different search term."
              : "Use “Choose readings” to add sections from the book."}
          </p>
        </div>
      }
    >
      <TableSelectionOverlay
        startItemId={startItemId}
        draggingFieldName={draggingFieldName}
        containerEl={containerEl}
        handleMouseUp={handleMouseUp}
        type="readings"
        exercises={filteredReadings}
      />
    </EditableDataTable>
  );
};
