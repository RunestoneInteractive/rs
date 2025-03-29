import styles from "@components/routes/AssignmentBuilder/AssignmentBuilder.module.css";
import { ChooseExercises } from "@components/routes/AssignmentBuilder/components/exercises/components/ChooseExercises/ChooseExercises";
import { SmartSearchExercises } from "@components/routes/AssignmentBuilder/components/exercises/components/SearchExercises/SmartSearchExercises";
import { Loader } from "@components/ui/Loader";
import { exercisesActions, exercisesSelectors } from "@store/exercises/exercises.logic";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";

import { CreateView } from "./CreateView";
import { EditView } from "./EditView";
import { ErrorDisplay } from "./ErrorDisplay";
import { ExerciseListView } from "./ExerciseListView";
import { ExerciseSuccessDialog } from "./ExerciseSuccessDialog";
import { ExercisesBreadcrumb } from "./ExercisesBreadcrumb";
import { AssignmentExercisesComponentProps, ViewMode } from "./types";

export const AssignmentExercisesContainer = ({
  startRowIndex,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: AssignmentExercisesComponentProps) => {
  const dispatch = useDispatch();
  const { loading, error, assignmentExercises = [], refetch } = useExercisesSelector();
  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);
  const [globalFilter, setGlobalFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastExerciseType, setLastExerciseType] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [resetExerciseForm, setResetExerciseForm] = useState(false);
  const { updateAssignmentExercises } = useUpdateAssignmentExercise();
  const [currentEditExercise, setCurrentEditExercise] = useState<Exercise | null>(null);

  const setSelectedExercises = (exercises: Exercise[]) => {
    if (startRowIndex === null) {
      dispatch(exercisesActions.setSelectedExercises(exercises));
    }
  };

  const handleRemoveSelected = async () => {
    if (!selectedExercises.length) return;

    await updateAssignmentExercises({
      idsToRemove: selectedExercises
        .map((x) => x.id)
        .filter((id): id is number => id !== undefined),
      isReading: false
    });
    setSelectedExercises([]);
  };

  const handleCreateAnother = () => {
    setShowSuccessDialog(false);
    setIsSaving(false);
    setResetExerciseForm(true);
    // Stay in "create" mode to create another exercise
  };

  const handleFinishCreating = () => {
    setShowSuccessDialog(false);
    setIsSaving(false);
    setViewMode("list");
  };

  if (loading) return <Loader />;

  if (error) {
    return <ErrorDisplay refetch={refetch} />;
  }

  // Type casting for the drag and drop handlers
  const typedHandleMouseDown = (rowIndex: number, fieldName: DraggingExerciseColumns) => {
    handleMouseDown(rowIndex, fieldName as any);
  };

  const typedHandleChange = (rowIndex: number, fieldName: DraggingExerciseColumns, value: any) => {
    handleChange(rowIndex, fieldName as any, value);
  };

  const typedHandleMouseUp = () => {
    handleMouseUp();
  };

  return (
    <div className={styles.exerciseManager}>
      <ExercisesBreadcrumb
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentEditExercise={currentEditExercise}
      />

      {viewMode === "list" && (
        <ExerciseListView
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          selectedExercises={selectedExercises}
          setSelectedExercises={setSelectedExercises}
          handleRemoveSelected={handleRemoveSelected}
          assignmentExercises={assignmentExercises}
          setViewMode={setViewMode}
          setResetExerciseForm={setResetExerciseForm}
          setCurrentEditExercise={setCurrentEditExercise}
          startRowIndex={startRowIndex}
          draggingFieldName={draggingFieldName as DraggingExerciseColumns | null}
          handleMouseDown={typedHandleMouseDown}
          handleMouseUp={typedHandleMouseUp}
          handleChange={typedHandleChange}
        />
      )}

      {viewMode === "browse" && <ChooseExercises />}

      {viewMode === "search" && <SmartSearchExercises />}

      {viewMode === "create" && (
        <CreateView
          setViewMode={setViewMode}
          resetExerciseForm={resetExerciseForm}
          setResetExerciseForm={setResetExerciseForm}
          setShowSuccessDialog={setShowSuccessDialog}
          setLastExerciseType={setLastExerciseType}
          setIsSaving={setIsSaving}
        />
      )}

      {viewMode === "edit" && (
        <EditView
          currentEditExercise={currentEditExercise}
          setCurrentEditExercise={setCurrentEditExercise}
          setViewMode={setViewMode}
          refetch={refetch}
        />
      )}

      <ExerciseSuccessDialog
        showSuccessDialog={showSuccessDialog}
        setShowSuccessDialog={setShowSuccessDialog}
        handleCreateAnother={handleCreateAnother}
        handleFinishCreating={handleFinishCreating}
        lastExerciseType={lastExerciseType}
      />
    </div>
  );
};
