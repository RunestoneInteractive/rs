import {
  searchExercisesActions,
  searchExercisesSelectors
} from "@store/searchExercises/searchExercises.logic";
import { Button } from "primereact/button";
import { confirmPopup, ConfirmPopup } from "primereact/confirmpopup";
import { MouseEvent } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useAddAssignmentExercise } from "@/hooks/useAddAssignmentExercise";
import { Exercise } from "@/types/exercises";

export const SearchExercisesHeader = () => {
  const dispatch = useDispatch();
  const { addExerciseToAssignment } = useAddAssignmentExercise();
  const selectedExercises = useSelector(searchExercisesSelectors.getSelectedExercises);

  const setSelectedExercises = (ex: Exercise[]) => {
    dispatch(searchExercisesActions.setSelectedExercises(ex));
  };

  const onAddClick = async (event: MouseEvent<HTMLButtonElement>) => {
    confirmPopup({
      target: event.currentTarget,
      message: `Are you sure you want to add ${selectedExercises.length} exercises?`,
      icon: "pi pi-exclamation-triangle",
      defaultFocus: "accept",
      accept: async () => {
        await addExerciseToAssignment(selectedExercises);

        setSelectedExercises([]);
      }
    });
  };

  return (
    <div className="flex flex-row justify-content-between pt-2 pb-2">
      <div>
        <ConfirmPopup />
        <Button
          onClick={onAddClick}
          icon="pi pi-plus"
          label={`Add ${selectedExercises.length} exercises`}
          size="small"
          severity="success"
        ></Button>
      </div>
    </div>
  );
};
