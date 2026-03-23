import {
  useCopyQuestionMutation,
  useValidateQuestionNameMutation,
  useGetExercisesQuery
} from "@store/assignmentExercise/assignmentExercise.logic.api";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { Exercise, supportedExerciseTypesToEdit } from "@/types/exercises";
import { regenerateHtmlSrc } from "@/utils/htmlRegeneration";

interface CopyExerciseModalProps {
  visible: boolean;
  onHide: () => void;
  exercise: Exercise | null;
  setCurrentEditExercise?: (exercise: Exercise | null) => void;
  setViewMode?: (mode: "list" | "browse" | "search" | "create" | "edit") => void;
}

export const CopyExerciseModal = ({
  visible,
  onHide,
  exercise,
  setCurrentEditExercise,
  setViewMode
}: CopyExerciseModalProps) => {
  const [newName, setNewName] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);

  const { selectedAssignment } = useSelectedAssignment();

  const [validateQuestionName] = useValidateQuestionNameMutation();
  const [copyQuestion, { isLoading: isCopying }] = useCopyQuestionMutation();
  const { refetch: refetchExercises } = useGetExercisesQuery(selectedAssignment?.id ?? 0, {
    skip: !selectedAssignment?.id
  });

  // Determine if the exercise type supports direct editing
  const canEditDirectly =
    exercise &&
    supportedExerciseTypesToEdit.includes(exercise.question_type) &&
    !!exercise.question_json;

  // Determine if we have the edit infrastructure available
  const hasEditSupport = !!setCurrentEditExercise && !!setViewMode;

  useEffect(() => {
    if (exercise && visible) {
      setNewName(exercise.name || "");
      setValidationMessage(null);
      setIsValid(false);
    }
  }, [exercise, visible]);

  useEffect(() => {
    const validateName = async () => {
      if (!newName.trim() || newName === exercise?.name) {
        setValidationMessage(null);
        setIsValid(false);
        return;
      }

      setIsValidating(true);
      try {
        const result = await validateQuestionName({
          name: newName.trim()
        }).unwrap();

        if (result.detail.is_unique) {
          setValidationMessage(null);
          setIsValid(true);
        } else {
          setValidationMessage("A question with this name already exists in this course");
          setIsValid(false);
        }
      } catch (error) {
        setValidationMessage("Error validating name");
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    const timeoutId = setTimeout(validateName, 300);

    return () => clearTimeout(timeoutId);
  }, [newName, exercise?.name, validateQuestionName]);

  const handleCopy = async () => {
    if (!exercise || !isValid) return;

    try {
      // Generate new HTML source with the new name if the exercise type is supported
      let newHtmlSrc: string | undefined;

      if (exercise.question_json && supportedExerciseTypesToEdit.includes(exercise.question_type)) {
        try {
          newHtmlSrc = regenerateHtmlSrc(exercise, newName.trim());
        } catch (htmlError) {
          console.error("Failed to regenerate HTML source:", htmlError);
        }
      }

      const result = await copyQuestion({
        original_question_id: exercise.question_id ?? exercise.id,
        new_name: newName.trim(),
        assignment_id: selectedAssignment?.id,
        copy_to_assignment: true,
        htmlsrc: newHtmlSrc
      }).unwrap();

      // Refetch the exercises list to pick up the newly added copy
      const exercises = await refetchExercises();
      const newExercise = exercises.data?.find(
        (ex) => ex.question_id === result.detail.question_id
      );

      const canEdit =
        newExercise &&
        supportedExerciseTypesToEdit.includes(newExercise.question_type) &&
        !!newExercise.question_json;

      if (canEdit && hasEditSupport) {
        toast.success("Exercise copied and added to assignment. Opening editor…");
        setCurrentEditExercise!(newExercise);
        setViewMode!("edit");
      } else if (newExercise) {
        toast.success("Exercise copied and added to your assignment. You are now the owner.", {
          duration: 5000
        });
      } else {
        toast.success("Exercise copied successfully! You are now the owner.");
      }

      handleClose();
    } catch (error) {
      toast.error("Error copying exercise");
    }
  };

  const handleClose = () => {
    setNewName("");
    setValidationMessage(null);
    setIsValid(false);
    onHide();
  };

  const getPrimaryButtonLabel = () => {
    if (isCopying) return "Copying…";
    if (canEditDirectly && hasEditSupport) return "Copy, Add & Edit";
    return "Copy & Add to Assignment";
  };

  const getPrimaryButtonIcon = () => {
    if (canEditDirectly && hasEditSupport) return "pi pi-pencil";
    return "pi pi-plus";
  };

  return (
    <Dialog
      visible={visible}
      onHide={handleClose}
      header="Copy Exercise"
      style={{ width: "480px" }}
      modal
      draggable={false}
      resizable={false}
    >
      <div className="flex flex-column gap-3">
        <Message
          severity="info"
          text="The copy will be added to your current assignment and you will become its owner."
          className="w-full"
        />

        <div>
          <label htmlFor="exerciseName" className="block text-900 font-medium mb-2">
            New Exercise Name
          </label>
          <InputText
            id="exerciseName"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter a unique name for the copy"
            className="w-full"
            invalid={validationMessage !== null}
          />
          {validationMessage && (
            <Message severity="error" text={validationMessage} className="mt-2 w-full" />
          )}
        </div>

        {canEditDirectly && hasEditSupport && (
          <Message
            severity="success"
            text="The copy will open in the editor immediately after it is created."
            className="w-full"
          />
        )}

        {!canEditDirectly && (
          <Message
            severity="warn"
            text="This exercise type does not support the visual editor. The copy will be added to your assignment but must be edited via other means."
            className="w-full"
          />
        )}

        <div className="flex justify-content-end gap-2 mt-2">
          <Button label="Cancel" outlined onClick={handleClose} disabled={isCopying} />
          <Button
            label={getPrimaryButtonLabel()}
            icon={getPrimaryButtonIcon()}
            onClick={handleCopy}
            disabled={!isValid || isCopying || isValidating}
            loading={isCopying}
          />
        </div>
      </div>
    </Dialog>
  );
};
