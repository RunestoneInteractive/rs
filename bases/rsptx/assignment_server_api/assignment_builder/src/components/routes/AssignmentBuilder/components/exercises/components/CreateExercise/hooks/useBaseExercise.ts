import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";

export type UseBaseExerciseProps<T extends Partial<CreateExerciseFormType>> = {
  initialData?: T;
  steps: { label: string }[];
  exerciseType: string;
  generatePreview: (data: T) => string;
  validateStep: (step: number, data: T) => boolean;
  validateForm: (data: T) => string[];
  getDefaultFormData: () => T;
  onSave: (data: T) => Promise<void>;
  onCancel: () => void;
  resetForm?: boolean;
  onFormReset?: () => void;
  isEdit?: boolean;
};

export const useBaseExercise = <T extends Partial<CreateExerciseFormType>>({
  initialData,
  steps,
  exerciseType,
  generatePreview,
  validateStep,
  validateForm,
  getDefaultFormData,
  onSave,
  onCancel,
  resetForm,
  onFormReset,
  isEdit = false
}: UseBaseExerciseProps<T>) => {
  // Initialize form data
  const [formData, setFormData] = useState<T>(() => {
    if (initialData) {
      return {
        ...getDefaultFormData(),
        ...initialData
      };
    }
    return getDefaultFormData();
  });

  // UI state
  const [activeStep, setActiveStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Track step validation
  const [stepsVisited, setStepsVisited] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(steps.map((_, index) => [index, false]))
  );

  // Track field interactions
  const [questionInteracted, setQuestionInteracted] = useState(false);
  const [settingsInteracted, setSettingsInteracted] = useState(false);

  // Reset form when resetForm is true
  useEffect(() => {
    if (resetForm && onFormReset) {
      setFormData(getDefaultFormData());
      setActiveStep(0);
      setIsSaving(false);
      setQuestionInteracted(false);
      setSettingsInteracted(false);
      setStepsVisited(Object.fromEntries(steps.map((_, index) => [index, false])));
      onFormReset();
    }
  }, [resetForm, onFormReset, steps, getDefaultFormData]);

  // Update form data field
  const updateFormData = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Handle settings changes
  const handleSettingsChange = useCallback((settings: Partial<T>) => {
    setFormData((prev) => ({
      ...prev,
      ...settings
    }));
    setSettingsInteracted(true);
  }, []);

  // Handle question content change
  const handleQuestionChange = useCallback(
    (content: string) => {
      updateFormData("statement" as keyof T, content as any);
      setQuestionInteracted(true);
    },
    [updateFormData]
  );

  // Check if current step is valid
  const isCurrentStepValid = useCallback(() => {
    return validateStep(activeStep, formData);
  }, [activeStep, formData, validateStep]);

  // Go to next step
  const goToNextStep = useCallback(() => {
    if (isCurrentStepValid()) {
      setStepsVisited((prev) => ({
        ...prev,
        [activeStep]: true
      }));
      setActiveStep((prev) => prev + 1);
    }
  }, [activeStep, isCurrentStepValid]);

  // Go to previous step
  const goToPrevStep = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  }, [activeStep]);

  // Generate HTML preview
  const generateHtmlPreview = useCallback(() => {
    try {
      return generatePreview(formData);
    } catch (error) {
      console.error("Error generating preview:", error);
      return "<div>Error generating preview</div>";
    }
  }, [formData, generatePreview]);

  // Handle save
  const handleSave = useCallback(async () => {
    const errors = validateForm(formData);

    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error));
      setStepsVisited(Object.fromEntries(steps.map((_, index) => [index, true])));
      setQuestionInteracted(true);
      setSettingsInteracted(true);
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        ...formData,
        htmlsrc: generateHtmlPreview(),
        points: formData.points || 1,
        name: formData.name || createExerciseId(),
        chapter: formData.chapter || "",
        question_type: exerciseType,
        difficulty: formData.difficulty || 3
      } as T);
    } catch (error) {
      console.error(`Error saving ${exerciseType} exercise:`, error);
      toast.error("Failed to save exercise");
      setIsSaving(false);
    }
  }, [validateForm, formData, steps, onSave, generateHtmlPreview, exerciseType]);

  return {
    formData,
    activeStep,
    isSaving,
    stepsVisited,
    questionInteracted,
    settingsInteracted,
    updateFormData,
    handleSettingsChange,
    handleQuestionChange,
    isCurrentStepValid,
    goToNextStep,
    goToPrevStep,
    handleSave,
    setStepsVisited,
    setActiveStep
  };
};
