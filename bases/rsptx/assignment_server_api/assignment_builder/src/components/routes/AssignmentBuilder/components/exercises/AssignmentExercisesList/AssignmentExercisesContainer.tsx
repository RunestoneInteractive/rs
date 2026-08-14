import styles from "@components/routes/AssignmentBuilder/AssignmentBuilder.module.css";
import { ChooseExercises } from "@components/routes/AssignmentBuilder/components/exercises/components/ChooseExercises/ChooseExercises";
import { SmartSearchExercises } from "@components/routes/AssignmentBuilder/components/exercises/components/SearchExercises/SmartSearchExercises";
import { Loader } from "@components/ui/Loader";
import { exercisesActions, exercisesSelectors } from "@store/exercises/exercises.logic";
import { notify } from "@components/ui/notify";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { useJwtUser } from "@/hooks/useJwtUser";
import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";
import { DraggingExerciseColumns } from "@/types/components/editableTableCell";
import { Exercise } from "@/types/exercises";
import { isExerciseEditable } from "@/utils/exercise";

import { useAssignmentRouting } from "../../../hooks/useAssignmentRouting";

import { CreateView } from "./CreateView";
import { EditView } from "./EditView";
import { ErrorDisplay } from "./ErrorDisplay";
import { ExerciseListView } from "./ExerciseListView";
import { ExerciseSuccessDialog } from "./ExerciseSuccessDialog";
import { AssignmentExercisesComponentProps } from "./types";

export const AssignmentExercisesContainer = ({
  startItemId,
  draggingFieldName,
  handleMouseDown,
  handleMouseUp,
  handleChange
}: AssignmentExercisesComponentProps) => {
  const dispatch = useDispatch();
  const { username } = useJwtUser();
  const {
    loading,
    error,
    assignmentExercises = [],
    exercisesReady = false,
    refetch
  } = useExercisesSelector();
  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastExerciseType, setLastExerciseType] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setIsSaving] = useState(false);
  const [resetExerciseForm, setResetExerciseForm] = useState(false);
  const { updateAssignmentExercises } = useUpdateAssignmentExercise();
  const [currentEditExercise, setCurrentEditExercise] = useState<Exercise | null>(null);

  const {
    exerciseViewMode: viewMode,
    exerciseId: routeExerciseId,
    updateExerciseViewMode
  } = useAssignmentRouting();

  // The route keeps pointing at the rejected id until the redirect lands, so the
  // effect would run again and toast twice without this.
  const rejectedExerciseIdRef = useRef<string | null>(null);

  // Opening the editor from the list sets currentEditExercise before navigating,
  // but arriving straight at /exercises/edit/<question_id> — a shared link, a
  // bookmark, a reload — has no such state, so resolve it from the exercises we
  // already loaded for this assignment. Bail out to the list for an id that isn't
  // here or isn't ours to edit, rather than rendering an empty pane.
  useEffect(() => {
    if (viewMode !== "edit") {
      rejectedExerciseIdRef.current = null;
      return;
    }
    if (currentEditExercise || !routeExerciseId) {
      return;
    }
    // The list is still in flight; a verdict now would always be "not found".
    if (loading || error || !exercisesReady) {
      return;
    }
    if (rejectedExerciseIdRef.current === routeExerciseId) {
      return;
    }

    const reject = (message: string) => {
      rejectedExerciseIdRef.current = routeExerciseId;
      notify.error(message);
      updateExerciseViewMode("list");
    };

    const match = assignmentExercises.find((ex) => String(ex.question_id) === routeExerciseId);

    if (!match) {
      reject("That exercise isn't part of this assignment.");
      return;
    }

    if (match.owner !== username) {
      reject("You can only edit exercises you wrote.");
      return;
    }

    if (!isExerciseEditable(match, username)) {
      reject("That exercise can't be opened in the editor.");
      return;
    }

    setCurrentEditExercise(match);
  }, [
    viewMode,
    routeExerciseId,
    currentEditExercise,
    assignmentExercises,
    loading,
    error,
    exercisesReady,
    username,
    updateExerciseViewMode
  ]);

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

      {viewMode === "search" && (
        <SmartSearchExercises
          setCurrentEditExercise={setCurrentEditExercise}
          setViewMode={(mode: "list" | "browse" | "search" | "create" | "edit") =>
            updateExerciseViewMode(mode)
          }
        />
      )}

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
