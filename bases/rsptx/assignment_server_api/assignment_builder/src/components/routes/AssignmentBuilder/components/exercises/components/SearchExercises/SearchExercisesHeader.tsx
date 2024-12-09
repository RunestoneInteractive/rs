import { useToastContext } from "@components/ui/ToastContext";
import { Button } from "primereact/button";
import { confirmPopup, ConfirmPopup } from "primereact/confirmpopup";
import { MouseEvent } from "react";

import { useAddAssignmentExercise } from "@/hooks/useAddAssignmentExercise";
import { Exercise } from "@/types/exercises";

export const SearchExercisesHeader = ({
  selectedExercises,
  setSelectedExercises
}: {
  setSelectedExercises: (exercises: Exercise[]) => void;
  selectedExercises: Exercise[];
}) => {
  const { addExerciseToAssignment } = useAddAssignmentExercise();
  const { showToast } = useToastContext();

  const onAddClick = async (event: MouseEvent<HTMLButtonElement>) => {
    confirmPopup({
      target: event.currentTarget,
      message: `Are you sure you want to add ${selectedExercises.length} exercises?`,
      icon: "pi pi-exclamation-triangle",
      defaultFocus: "accept",
      accept: async () => {
        const response = await addExerciseToAssignment(selectedExercises);

        if (response.every((x) => !!x.data)) {
          showToast({
            severity: "info",
            sticky: true,
            summary: "Success",
            detail: "Exercise has been added!"
          });
          setSelectedExercises([]);
        } else {
          showToast({
            severity: "error",
            sticky: true,
            summary: "Error",
            detail: "Something went wrong. Please, try again"
          });
        }
      }
    });
  };

  return (
    <div className="flex flex-row justify-content-between pt-2 pb-2">
      <div>
        <ConfirmPopup />
        {!!selectedExercises.length && (
          <Button
            onClick={onAddClick}
            icon="pi pi-plus"
            label={`Add ${selectedExercises.length} exercises`}
            size="small"
            severity="danger"
          ></Button>
        )}
      </div>
    </div>
  );
};
