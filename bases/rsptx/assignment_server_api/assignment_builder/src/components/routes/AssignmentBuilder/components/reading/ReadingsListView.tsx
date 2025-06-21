import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

import { AssignmentReadingsTable } from "./AssignmentReadingsTable";
import { ReadingsToolbar } from "./ReadingsToolbar";
import { SetCurrentEditReading, MouseUpHandler } from "./types";

interface ReadingsListViewProps {
  globalFilter: string;
  setGlobalFilter: (filter: string) => void;
  selectedReadings: Exercise[];
  setSelectedReadings: (readings: Exercise[]) => void;
  handleRemoveSelected: () => void;
  assignmentReadings: Exercise[];
  setCurrentEditReading: SetCurrentEditReading;
  startItemId: number | null;
  draggingFieldName: DraggingExerciseColumns | null;
  handleMouseDown: (itemId: number, fieldName: DraggingExerciseColumns) => void;
  handleMouseUp: MouseUpHandler;
  handleChange: (itemId: number, fieldName: DraggingExerciseColumns, value: any) => void;
}

export const ReadingsListView = ({
  globalFilter,
  setGlobalFilter,
  selectedReadings,
  setSelectedReadings,
  handleRemoveSelected,
  assignmentReadings,
  setCurrentEditReading,
  startItemId,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: ReadingsListViewProps) => {
  return (
    <div className="surface-card p-3 border-round">
      <ReadingsToolbar
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        selectedReadings={selectedReadings}
        handleRemoveSelected={handleRemoveSelected}
      />
      <AssignmentReadingsTable
        assignmentReadings={assignmentReadings}
        selectedReadings={selectedReadings}
        setSelectedReadings={setSelectedReadings}
        globalFilter={globalFilter}
        setCurrentEditReading={setCurrentEditReading}
        setViewMode={() => {}}
        startItemId={startItemId}
        draggingFieldName={draggingFieldName}
        handleMouseDown={handleMouseDown}
        handleMouseUp={handleMouseUp}
        handleChange={handleChange}
      />
    </div>
  );
};
