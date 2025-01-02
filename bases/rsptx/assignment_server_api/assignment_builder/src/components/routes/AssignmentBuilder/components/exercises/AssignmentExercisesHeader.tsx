import { useDialogContext } from "@components/ui/DialogContext";
import { exercisesActions, exercisesSelectors } from "@store/exercises/exercises.logic";
import { Button } from "primereact/button";
import { confirmPopup, ConfirmPopup } from "primereact/confirmpopup";
import { MouseEvent } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useUpdateAssignmentExercise } from "@/hooks/useUpdateAssignmentExercise";
import { Exercise } from "@/types/exercises";

import { AddExerciseModal } from "./AddExerciseModal";

export const AssignmentExercisesHeader = () => {
  const dispatch = useDispatch();
  const { showDialog } = useDialogContext();
  const { updateAssignmentExercises } = useUpdateAssignmentExercise();

  const selectedExercises = useSelector(exercisesSelectors.getSelectedExercises);

  const setSelectedExercises = (exercises: Exercise[]) => {
    dispatch(exercisesActions.setSelectedExercises(exercises));
  };

  const onRemoveClick = (event: MouseEvent<HTMLButtonElement>) => {
    confirmPopup({
      target: event.currentTarget,
      message: `Are you sure you want to remove ${selectedExercises.length} exercises?`,
      icon: "pi pi-exclamation-triangle",
      defaultFocus: "accept",
      accept: async () => {
        await updateAssignmentExercises(
          {
            idsToRemove: selectedExercises.map((x) => x.id),
            isReading: false
          },
          () => {
            setSelectedExercises([]);
          }
        );
      }
    });
  };

  const title = "Graded Exercises";

  const onInfoButtonClick = () => {
    showDialog({
      style: { width: "50vw" },
      header: title,
      children: (
        <>
          <p className="m-0">
            Graded questions are meant to be <strong>summative</strong> and therefore the questions
            are graded for correctness. The correctness of a question is recorded at the time the
            student answers the question. The autograde field determines how the questions are
            scored, for example &ldquo;all or nothing&rdquo; or &ldquo;percent correct&rdquo;. The
            which_to_grade field determines which answer to grade, for example the first answer or
            the last answer. normally this is set to &ldquo;best answer&rdquo;. This allows you to
            change the way and assignment is scored even after the students have answered the
            questions.
          </p>
          <p>
            The table below can be thought of like a spreadsheet. You can reorder the questions by
            dragging the rows. You can delete a question by right clicking in the margin. You can
            copy and paste values across multple rows within a column to change the default values
            for points, autograde or which to grade.
          </p>
        </>
      )
    });
  };

  return (
    <div className="flex flex-row justify-content-between">
      <div className="flex flex-row gap-2 align-items-center">
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
        {!selectedExercises.length && (
          <div className="flex align-items-center gap-2 ml-2">
            <span className="p-panel-title">{title}</span>
            <button className="p-panel-header-icon p-link mr-2">
              <span>
                <i className="pi pi-info-circle" onClick={onInfoButtonClick}></i>
              </span>
            </button>
          </div>
        )}
      </div>
      <AddExerciseModal />
    </div>
  );
};
