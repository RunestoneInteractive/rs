import { useCallback, useEffect, useState } from "react";
import { UseFormWatch } from "react-hook-form";

import { Assignment } from "@/types/assignment";

interface UseNameValidationProps {
  assignments: Assignment[];
  watch: UseFormWatch<Assignment>;
}

export const useNameValidation = ({ assignments, watch }: UseNameValidationProps) => {
  const [nameError, setNameError] = useState<string | null>(null);
  const [canProceed, setCanProceed] = useState(false);
  const [isNameTouched, setIsNameTouched] = useState(false);

  const validateName = useCallback(
    (name: string): string | null => {
      if (!name || !name.trim()) {
        return "Assignment name is required";
      }
      if (assignments.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
        return "An assignment with this name already exists";
      }
      return null;
    },
    [assignments]
  );

  const validateAndUpdateState = useCallback(
    (name: string | undefined) => {
      const currentName = name ?? "";
      const error = validateName(currentName);
      const isValid = Boolean(currentName.trim()) && !error;

      setNameError(isNameTouched ? error : null);
      setCanProceed(isValid);
    },
    [validateName, isNameTouched]
  );

  useEffect(() => {
    const subscription = watch((value, { name: fieldName }) => {
      if (fieldName === "name") {
        setIsNameTouched(true);
      }
      validateAndUpdateState(value.name);
    });

    return () => subscription.unsubscribe();
  }, [watch, validateAndUpdateState]);

  // Initial validation for canProceed
  useEffect(() => {
    validateAndUpdateState(watch("name"));
  }, [validateAndUpdateState, watch]);

  return {
    nameError: isNameTouched ? nameError : null,
    canProceed,
    validateName
  };
};
