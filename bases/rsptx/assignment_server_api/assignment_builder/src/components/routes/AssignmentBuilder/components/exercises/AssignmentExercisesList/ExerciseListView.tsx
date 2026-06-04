import { useScrollShadow } from "@components/shell/useScrollShadow";

import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

import { AssignmentExercisesTable } from "./AssignmentExercisesTable";
import { ExercisesToolbar } from "./ExercisesToolbar";
import { SetCurrentEditExercise, ViewModeSetter, MouseUpHandler } from "./types";

import styles from "./ExerciseListView.module.css";

interface ExerciseListViewProps {
  globalFilter: string;
  setGlobalFilter: (filter: string) => void;
  selectedExercises: Exercise[];
  setSelectedExercises: (exercises: Exercise[]) => void;
  handleRemoveSelected: () => void;
  assignmentExercises: Exercise[];
  setViewMode: ViewModeSetter;
  setResetExerciseForm: (reset: boolean) => void;
  setCurrentEditExercise: SetCurrentEditExercise;
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

export const ExerciseListView = ({
  globalFilter,
  setGlobalFilter,
  selectedExercises,
  setSelectedExercises,
  handleRemoveSelected,
  assignmentExercises,
  setViewMode,
  setResetExerciseForm,
  setCurrentEditExercise,
  startItemId,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: ExerciseListViewProps) => {
  const { sentinelRef, scrolled } = useScrollShadow();

  return (
    <section className={styles.card} aria-label="Exercises">
      <ExercisesToolbar
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        totalCount={assignmentExercises.length}
        selectedExercises={selectedExercises}
        handleRemoveSelected={handleRemoveSelected}
        setViewMode={setViewMode}
        setResetExerciseForm={setResetExerciseForm}
        scrolled={scrolled}
      />
      <AssignmentExercisesTable
        assignmentExercises={assignmentExercises}
        selectedExercises={selectedExercises}
        setSelectedExercises={setSelectedExercises}
        globalFilter={globalFilter}
        setCurrentEditExercise={setCurrentEditExercise}
        setViewMode={setViewMode}
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
