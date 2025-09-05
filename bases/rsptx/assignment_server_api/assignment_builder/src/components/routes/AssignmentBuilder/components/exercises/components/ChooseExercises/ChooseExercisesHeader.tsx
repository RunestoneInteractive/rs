import { useAssignmentRouting } from "@components/routes/AssignmentBuilder/hooks/useAssignmentRouting";
import { chooseExercisesSelectors } from "@store/chooseExercises/chooseExercises.logic";
import { datasetSelectors } from "@store/dataset/dataset.logic";
import { Button } from "primereact/button";
import { confirmPopup, ConfirmPopup } from "primereact/confirmpopup";
import { InputSwitch } from "primereact/inputswitch";
import { MultiSelect } from "primereact/multiselect";
import { MouseEvent } from "react";
import { useSelector } from "react-redux";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";

interface ChooseExercisesHeaderProps {
  resetSelections: () => void;
  selectedQuestionTypes: string[];
  onQuestionTypeChange: (selectedTypes: string[]) => void;
  fromSourceOnly: boolean;
  onFromSourceChange: (fromSourceOnly: boolean) => void;
}

export const ChooseExercisesHeader = ({
  resetSelections,
  selectedQuestionTypes,
  onQuestionTypeChange,
  fromSourceOnly,
  onFromSourceChange
}: ChooseExercisesHeaderProps) => {
  const { updateAssignmentExercises } = useUpdateAssignmentExercise();

  const exercisesToAdd = useSelector(chooseExercisesSelectors.getExercisesToAdd);
  const exercisesToRemove = useSelector(chooseExercisesSelectors.getExercisesToRemove);
  const questionTypeOptions = useSelector(datasetSelectors.getQuestionTypeOptions);

  const { navigateToExercises } = useAssignmentRouting();
  const { selectedAssignment } = useSelectedAssignment();

  const onChooseButtonClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (!selectedAssignment) {
      console.error("ChooseExercisesHeader: No selected assignment");
      return;
    }

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
        navigateToExercises(selectedAssignment.id.toString());
      }
    });
  };

  const hasAnyChanges = !!exercisesToAdd.length || !!exercisesToRemove.length;

  return (
    <div className="flex flex-row gap-2 justify-content-between align-items-center">
      <div>
        <ConfirmPopup />
        {hasAnyChanges && (
          <Button
            onClick={onChooseButtonClick}
            icon="pi pi-check"
            label="Choose exercises"
            size="small"
            severity="warning"
            className="text-sm"
          />
        )}
      </div>
      <div className="flex align-items-center gap-2">
        <div className="flex align-items-center gap-2">
          <label htmlFor="source-switch" className="text-sm font-medium text-gray-700">
            {fromSourceOnly ? "Book exercises" : "All Exercises"}
          </label>
          <InputSwitch
            inputId="source-switch"
            checked={fromSourceOnly}
            onChange={(e) => onFromSourceChange(e.value)}
            className="p-inputswitch-sm"
            style={{ transform: "scale(0.8)" }}
            tooltip="Show only exercises from the source material"
            tooltipOptions={{ position: "bottom" }}
          />
        </div>
        <MultiSelect
          value={selectedQuestionTypes}
          options={questionTypeOptions}
          onChange={(e) => onQuestionTypeChange(e.value)}
          optionLabel="label"
          optionValue="value"
          placeholder="Exercise types"
          className="text-sm"
          style={{
            minWidth: "250px",
            maxWidth: "250px"
          }}
          panelClassName="text-sm"
          maxSelectedLabels={1}
          selectedItemsLabel="{0} exercise types selected"
        />
        <Button
          icon="pi pi-replay"
          rounded
          tooltipOptions={{ showDelay: 500, position: "left" }}
          tooltip="Reset selection"
          disabled={!hasAnyChanges}
          onClick={resetSelections}
          style={{
            width: "16px",
            height: "16px",
            fontSize: "0.75rem",
            padding: "16px"
          }}
        />
      </div>
    </div>
  );
};
