import { chooseExercisesSelectors } from "@store/chooseExercises/chooseExercises.logic";
import { Button } from "primereact/button";
import { confirmPopup, ConfirmPopup } from "primereact/confirmpopup";
import { MouseEvent } from "react";
import { useSelector } from "react-redux";

import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";

export const ChooseExercisesHeader = ({ resetSelections }: { resetSelections: VoidFunction }) => {
  const { updateAssignmentExercises } = useUpdateAssignmentExercise();

  const exercisesToAdd = useSelector(chooseExercisesSelectors.getExercisesToAdd);
  const exercisesToRemove = useSelector(chooseExercisesSelectors.getExercisesToRemove);

  const onChooseButtonClick = async (event: MouseEvent<HTMLButtonElement>) => {
    const addText = exercisesToAdd.length ? `add ${exercisesToAdd.length}` : "";
    const removeText = exercisesToRemove.length ? `remove ${exercisesToRemove.length}` : "";
    const conjunction = addText && removeText ? " and " : "";

    const popupText = `Are you sure you want to ${addText}${conjunction}${removeText} exercises?`;

    confirmPopup({
      target: event.currentTarget,
      message: popupText,
      icon: "pi pi-exclamation-triangle",
      defaultFocus: "accept",
      accept: async () => {
        await updateAssignmentExercises({
          idsToAdd: exercisesToAdd.map((x) => x.id),
          idsToRemove: exercisesToRemove.map((x) => x.id),
          isReading: false
        });
      }
    });
  };

  const hasAnyChanges = !!exercisesToAdd.length || !!exercisesToRemove.length;

  return (
    <div className="flex flex-row  gap-2 justify-content-between align-items-center">
      <div>
        <ConfirmPopup />
        {hasAnyChanges && (
          <Button
            onClick={onChooseButtonClick}
            icon="pi pi-check"
            label="Choose exercises"
            size="small"
            severity="warning"
          />
        )}
      </div>
      <Button
        icon="pi pi-replay"
        rounded
        size="small"
        tooltipOptions={{ showDelay: 500, position: "left" }}
        tooltip="Reset selection"
        disabled={!hasAnyChanges}
        onClick={resetSelections}
      />
    </div>
  );
};
