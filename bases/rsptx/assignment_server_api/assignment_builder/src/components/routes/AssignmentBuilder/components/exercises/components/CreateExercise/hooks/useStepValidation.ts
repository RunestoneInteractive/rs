import { useMemo } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import { StepValidator } from "../config/stepConfigs";

export interface ValidationState {
  errors: string[];
  isValid: boolean;
}

export interface UseStepValidationProps<T extends Partial<CreateExerciseFormType>> {
  data: T;
  activeStep: number;
  stepValidators: StepValidator<T>[];
}

export const useStepValidation = <T extends Partial<CreateExerciseFormType>>({
  data,
  activeStep,
  stepValidators
}: UseStepValidationProps<T>): ValidationState => {
  // Run validation for current step
  return useMemo(() => {
    if (!stepValidators[activeStep]) {
      return { isValid: true, errors: [] };
    }

    const validationFn = stepValidators[activeStep];
    const errors = validationFn(data);

    return {
      errors,
      isValid: errors.length === 0
    };
  }, [activeStep, data, stepValidators]);
};
