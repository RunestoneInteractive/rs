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

import { useAssignmentRouting } from "../../../hooks/useAssignmentRouting";

import { CreateView } from "./CreateView";
import { EditView } from "./EditView";
import { ErrorDisplay } from "./ErrorDisplay";
import { ExerciseListView } from "./ExerciseListView";
import { ExerciseSuccessDialog } from "./ExerciseSuccessDialog";
import { AssignmentExercisesComponentProps, ViewMode } from "./types";

export const AssignmentExercisesContainer = ({
  startItemId,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: AssignmentExercisesComponentProps) => {
  const dispatch = useDispatch();
  const { loading, error, assignmentExercises = [], refetch } = useExercisesSelector();
  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastExerciseType, setLastExerciseType] = useState<string>("");
  const [_, setIsSaving] = useState(false);
  const [resetExerciseForm, setResetExerciseForm] = useState(false);
  const { updateAssignmentExercises } = useUpdateAssignmentExercise();
  const [currentEditExercise, setCurrentEditExercise] = useState<Exercise | null>(null);

  const { exerciseViewMode: viewMode, updateExerciseViewMode } = useAssignmentRouting();

  const setSelectedExercises = (exercises: Exercise[]) => {
    if (startItemId === null) {
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
    updateExerciseViewMode("create");
  };

  const handleFinishCreating = () => {
    setShowSuccessDialog(false);
    setIsSaving(false);
    updateExerciseViewMode("list");
  };

  if (loading) return <Loader />;

  if (error) {
    return <ErrorDisplay refetch={refetch} />;
  }

  return (
    <div className={styles.exerciseManager}>
      {viewMode === "list" && (
        <ExerciseListView
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          selectedExercises={selectedExercises}
          setSelectedExercises={setSelectedExercises}
          handleRemoveSelected={handleRemoveSelected}
          assignmentExercises={assignmentExercises}
          setViewMode={updateExerciseViewMode}
          setResetExerciseForm={setResetExerciseForm}
          setCurrentEditExercise={setCurrentEditExercise}
          startItemId={startItemId}
          draggingFieldName={draggingFieldName as DraggingExerciseColumns | null}
          handleMouseDown={handleMouseDown}
          handleMouseUp={handleMouseUp}
          handleChange={handleChange}
        />
      )}

      {viewMode === "browse" && <ChooseExercises />}

      {viewMode === "search" && <SmartSearchExercises />}

      {viewMode === "create" && (
        <CreateView
          setViewMode={updateExerciseViewMode}
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
          setViewMode={updateExerciseViewMode}
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
