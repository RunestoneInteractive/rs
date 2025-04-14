import { useCallback, useLayoutEffect, useMemo, useState } from "react";

import { CreateExerciseFormType } from "@/types/exercises";

import { StepValidator } from "../config/stepConfigs";

import { ValidationState } from "./useStepValidation";

export interface UseExerciseStepNavigationProps<T extends Partial<CreateExerciseFormType>> {
  data: T;
  activeStep: number;
  setActiveStep: (step: number) => void;
  stepValidators: StepValidator<T>[];
  goToNextStep: () => void;
  goToPrevStep: () => void;
  steps: { label: string }[];
  handleBaseSave: () => Promise<void>;
  generateHtmlSrc?: (data: T) => string;
  updateFormData?: <K extends keyof T>(field: K, value: T[K]) => void;
}

export interface ExerciseStepNavigationState {
  validation: ValidationState | undefined;
  handleNext: () => void;
  handleStepSelect: (index: number) => void;
  handleSave: () => Promise<void>;
  stepsValidity: Record<number, boolean>;
}

export const useExerciseStepNavigation = <T extends Partial<CreateExerciseFormType>>({
  data,
  activeStep,
  setActiveStep,
  stepValidators,
  goToNextStep,
  goToPrevStep,
  steps,
  handleBaseSave,
  generateHtmlSrc,
  updateFormData
}: UseExerciseStepNavigationProps<T>): ExerciseStepNavigationState => {
  // State to track when to show validation errors
  const [showValidation, setShowValidation] = useState(false);

  // Reset validation state when moving to a new step
  useLayoutEffect(() => {
    setShowValidation(false);
  }, [activeStep]);

  // Calculate validation state for current step
  const validation = useMemo(() => {
    // Only compute validation when showValidation is true
    if (!showValidation) {
      return undefined;
    }

    if (!stepValidators[activeStep]) {
      return { isValid: true, errors: [] };
    }

    const validationFn = stepValidators[activeStep];
    const errors = validationFn(data);

    return {
      errors,
      isValid: errors.length === 0
    };
  }, [activeStep, data, stepValidators, showValidation]);

  // Calculate all steps validity
  const stepsValidity = useMemo(() => {
    const validity: Record<number, boolean> = {};

    steps.forEach((_, index) => {
      if (!stepValidators[index]) {
        validity[index] = true;
        return;
      }
      const errors = stepValidators[index](data);

      validity[index] = errors.length === 0;
    });

    return validity;
  }, [data, steps, stepValidators]);

  // Handler for Next button
  const handleNext = useCallback(() => {
    // Only set validation to true when user tries to proceed
    setShowValidation(true);

    // Proceed only if validation passes
    if (stepsValidity[activeStep]) {
      goToNextStep();
    }
  }, [activeStep, goToNextStep, stepsValidity]);

  // Handler for step selection
  const handleStepSelect = useCallback(
    (index: number) => {
      // Only show validation when trying to go forward
      if (index > activeStep) {
        setShowValidation(true);

        // Check if current step is valid before allowing forward navigation
        if (!stepsValidity[activeStep]) {
          return; // Prevent navigation if current step is invalid
        }
      }

      // Always allow backward navigation
      setActiveStep(index);
    },
    [activeStep, setActiveStep, stepsValidity]
  );

  // Handler for saving the exercise
  const handleSave = useCallback(async () => {
    // Show validation on save attempt
    setShowValidation(true);

    // Check if all steps are valid
    const allStepsValid = Object.values(stepsValidity).every((valid) => valid);

    // Only save if all steps are valid
    if (!allStepsValid) {
      return;
    }

    // Generate HTML source if needed and update form data
    if (generateHtmlSrc && updateFormData) {
      const htmlsrc = generateHtmlSrc(data);

      updateFormData("htmlsrc" as keyof T, htmlsrc as T[keyof T]);
    }

    // Call the base save function
    await handleBaseSave();
  }, [data, generateHtmlSrc, handleBaseSave, stepsValidity, updateFormData]);

  return {
    validation,
    handleNext,
    handleStepSelect,
    handleSave,
    stepsValidity
  };
};
