import { exercisesActions, exercisesSelectors } from "@store/exercises/exercises.logic";
import { Button } from "primereact/button";
import { confirmPopup, ConfirmPopup } from "primereact/confirmpopup";
import { useDispatch, useSelector } from "react-redux";

import { useExercisesSelector } from "@/hooks/useExercisesSelector";
import { Exercise } from "@/types/exercises";

import { AddExerciseModal } from "./AddExerciseModal";

export const AssignmentExercisesHeader = () => {
  const dispatch = useDispatch();
  const { removeExercises } = useExercisesSelector();

  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);

  const setSelectedExercises = (exercises: Exercise[]) => {
    dispatch(exercisesActions.setSelectedExercises(exercises));
  };

  const onRemoveClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    confirmPopup({
      target: event.currentTarget,
      message: `Are you sure you want to remove ${selectedExercises.length} exercises?`,
      icon: "pi pi-exclamation-triangle",
      defaultFocus: "accept",
      accept: () => {
        removeExercises?.(selectedExercises);
        setSelectedExercises([]);
      }
    });
  };

  return (
    <div className="flex flex-row justify-content-between pt-2 pb-2">
      <div>
        <ConfirmPopup />
        {!!selectedExercises.length && (
          <Button
            onClick={onRemoveClick}
            icon="pi pi-trash"
            label={`Remove ${selectedExercises.length} exercises`}
            size="small"
            severity="danger"
          ></Button>
        )}
      </div>
      <AddExerciseModal />
    </div>
  );
};
