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

interface CopyExerciseModalProps {
  visible: boolean;
  onHide: () => void;
  exercise: Exercise | null;
  copyToAssignment?: boolean;
  setCurrentEditExercise?: (exercise: Exercise | null) => void;
  setViewMode?: (mode: "list" | "browse" | "search" | "create" | "edit") => void;
}

export const CopyExerciseModal = ({
  visible,
  onHide,
  exercise,
  copyToAssignment = false,
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
      const result = await copyQuestion({
        original_question_id: exercise.question_id ?? exercise.id,
        new_name: newName.trim(),
        assignment_id: copyToAssignment ? selectedAssignment?.id : undefined,
        copy_to_assignment: copyToAssignment
      }).unwrap();

      if (setCurrentEditExercise && setViewMode && copyToAssignment && result.detail.question_id) {
        const exercises = await refetchExercises();
        const newExercise = exercises.data?.find(
          (ex) => ex.question_id === result.detail.question_id
        );
        const canEdit =
          newExercise &&
          supportedExerciseTypesToEdit.includes(newExercise.question_type) &&
          !!newExercise.question_json;

        if (canEdit) {
          setCurrentEditExercise(newExercise);
          setViewMode("edit");
        }
      }

      toast.success("Exercise copied successfully!");
      onHide();
    } catch (error) {
      toast.error("Error copying exercise");
    }
  };

  const handleCancel = () => {
    setNewName("");
    setValidationMessage(null);
    setIsValid(false);
    onHide();
  };

  return (
    <Dialog
      visible={visible}
      onHide={handleCancel}
      header="Copy Exercise"
      style={{ width: "400px" }}
      modal
      draggable={false}
      resizable={false}
    >
      <div className="flex flex-column gap-3">
        <div>
          <label htmlFor="exerciseName" className="block text-900 font-medium mb-2">
            Exercise Name
          </label>
          <InputText
            id="exerciseName"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new exercise name"
            className="w-full"
            invalid={validationMessage !== null}
          />
          {validationMessage && (
            <Message severity="error" text={validationMessage} className="mt-2" />
          )}
        </div>

        <div className="flex justify-content-end gap-2 mt-3">
          <Button label="Cancel" outlined onClick={handleCancel} disabled={isCopying} />
          <Button
            label="Copy Exercise"
            onClick={handleCopy}
            disabled={!isValid || isCopying || isValidating}
          />
        </div>
      </div>
    </Dialog>
  );
};
