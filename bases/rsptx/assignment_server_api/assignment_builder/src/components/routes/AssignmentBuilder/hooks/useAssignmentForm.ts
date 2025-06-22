import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

import { Assignment } from "@/types/assignment";

import { defaultAssignment } from "../defaultAssignment";

interface UseAssignmentFormProps {
  selectedAssignment: Assignment | null;
  mode: "list" | "create" | "edit";
  onAssignmentUpdate?: (assignment: Partial<Assignment>) => void;
}

export const useAssignmentForm = ({
  selectedAssignment,
  mode,
  onAssignmentUpdate
}: UseAssignmentFormProps) => {
  const { control, watch, setValue, reset, getValues } = useForm<Assignment>({
    defaultValues: selectedAssignment || defaultAssignment
  });

  const isResetRef = useRef(false);

  useEffect(() => {
    if (selectedAssignment && mode === "edit") {
      isResetRef.current = true;
      reset(selectedAssignment);
      isResetRef.current = false;
    }
  }, [selectedAssignment, reset, mode]);

  useEffect(() => {
    const subscription = watch((formValues) => {
      if (isResetRef.current) {
        isResetRef.current = false;
        return;
      }

      if (formValues && Object.keys(formValues).length > 0 && mode === "edit") {
        onAssignmentUpdate?.(formValues);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, onAssignmentUpdate, mode]);

  const handleNameChange = useCallback(
    (value: string) => {
      setValue("name", value);
    },
    [setValue]
  );

  return {
    control,
    watch,
    setValue,
    reset,
    getValues,
    handleNameChange
  };
};
