import { useScrollShadow } from "@components/shell/useScrollShadow";

import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

import { AssignmentReadingsTable } from "./AssignmentReadingsTable";
import { ReadingsToolbar } from "./ReadingsToolbar";
import { MouseUpHandler } from "./types";

import styles from "./ReadingsListView.module.css";

interface ReadingsListViewProps {
  globalFilter: string;
  setGlobalFilter: (filter: string) => void;
  selectedReadings: Exercise[];
  setSelectedReadings: (readings: Exercise[]) => void;
  handleRemoveSelected: () => void;
  assignmentReadings: Exercise[];
  startItemId: number | null;
  draggingFieldName: DraggingExerciseColumns | null;
  handleMouseDown: (itemId: number, fieldName: DraggingExerciseColumns) => void;
  handleMouseUp: MouseUpHandler;
  handleChange: (
    itemId: number,
    fieldName: DraggingExerciseColumns,
    value: string | number
  ) => void;
}

export const ReadingsListView = ({
  globalFilter,
  setGlobalFilter,
  selectedReadings,
  setSelectedReadings,
  handleRemoveSelected,
  assignmentReadings,
  startItemId,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: ReadingsListViewProps) => {
  const { sentinelRef, scrolled } = useScrollShadow();

  return (
    <section className={styles.card} aria-label="Sections to read">
      <ReadingsToolbar
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        totalCount={assignmentReadings.length}
        selectedReadings={selectedReadings}
        handleRemoveSelected={handleRemoveSelected}
        scrolled={scrolled}
      />
      <AssignmentReadingsTable
        assignmentReadings={assignmentReadings}
        selectedReadings={selectedReadings}
        setSelectedReadings={setSelectedReadings}
        globalFilter={globalFilter}
        startItemId={startItemId}
        draggingFieldName={draggingFieldName}
        handleMouseDown={handleMouseDown}
        handleMouseUp={handleMouseUp}
        handleChange={handleChange}
        scrollSentinelRef={sentinelRef}
      />
    </section>
  );
};
