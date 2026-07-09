import { Icon } from "@components/ui/Icon";
import { Alert, Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import {
  useCopyQuestionMutation,
  useValidateQuestionNameMutation,
  useGetExercisesQuery
} from "@store/assignmentExercise/assignmentExercise.logic.api";
import { useEffect, useState } from "react";

import { useSelectedAssignment } from "@/hooks/useSelectedAssignment";
import { Exercise, supportedExerciseTypesToEdit } from "@/types/exercises";
import { regenerateHtmlSrc } from "@/utils/htmlRegeneration";
import { notify } from "@components/ui/notify";

export const COPY_EXERCISE_TOAST_COPY = {
  copiedAndEditing: "Copy added to this assignment. Opening editor…",
  copied: "Copy added to this assignment. You own it now.",
  copyError: "Couldn't copy exercise. Try again."
} as const;

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

  const canEditDirectly =
    exercise &&
    supportedExerciseTypesToEdit.includes(exercise.question_type) &&
    !!exercise.question_json;

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
          setValidationMessage(
            "An exercise with this name already exists in this course. Pick another name."
          );
          setIsValid(false);
        }
      } catch (error) {
        setValidationMessage("Couldn't check the name. Try again.");
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

      const exercises = await refetchExercises();
      const newExercise = exercises.data?.find(
        (ex) => ex.question_id === result.detail.question_id
      );

      const canEdit =
        newExercise &&
        supportedExerciseTypesToEdit.includes(newExercise.question_type) &&
        !!newExercise.question_json;

      if (canEdit && hasEditSupport) {
        notify.success(COPY_EXERCISE_TOAST_COPY.copiedAndEditing);
        setCurrentEditExercise!(newExercise);
        setViewMode!("edit");
      } else {
        notify.success(COPY_EXERCISE_TOAST_COPY.copied);
      }

      handleClose();
    } catch (error) {
      notify.error(COPY_EXERCISE_TOAST_COPY.copyError);
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
    if (canEditDirectly && hasEditSupport) return "Copy, add, and edit";
    return "Copy and add to assignment";
  };

  const primaryButtonIcon =
    canEditDirectly && hasEditSupport ? <Icon name="pencil" /> : <Icon name="plus" />;

  return (
    <Modal opened={visible} onClose={handleClose} title="Copy exercise" size={480} centered>
      <Stack gap="md">
        <Alert color="blue">
          The copy will be added to your current assignment and you will become its owner.
        </Alert>

        <TextInput
          id="exerciseName"
          label="Name for the copy"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Enter a unique name for the copy"
          error={validationMessage || undefined}
        />

        {canEditDirectly && hasEditSupport && (
          <Alert color="green">
            The copy will open in the editor immediately after it is created.
          </Alert>
        )}

        {!canEditDirectly && (
          <Alert color="yellow">
            This exercise type doesn&apos;t have a visual editor. The copy will be added to your
            assignment, but you can edit it in your book source, not here.
          </Alert>
        )}

        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="outline" onClick={handleClose} disabled={isCopying}>
            Cancel
          </Button>
          <Button
            leftSection={primaryButtonIcon}
            onClick={handleCopy}
            disabled={!isValid || isCopying || isValidating}
            loading={isCopying}
          >
            {getPrimaryButtonLabel()}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
