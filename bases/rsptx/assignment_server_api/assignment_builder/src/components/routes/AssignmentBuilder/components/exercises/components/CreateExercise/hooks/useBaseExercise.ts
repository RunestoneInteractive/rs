import { useCallback, useEffect, useState } from "react";

import { CreateExerciseFormType, Option } from "@/types/exercises";
import { notify } from "@components/ui/notify";
import { createExerciseId } from "@/utils/exercise";
import { OptionWithId } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/components";

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

const handleOptionIds = (options?: OptionWithId[] | Option[]) => {
  const opts = options ?? [];
  return opts.map((opt) => {
    if (!("id" in opt) || !opt.id) {
      return {
        ...opt,
        id: `option-${crypto.randomUUID()}`
      };
    }
    return opt as OptionWithId;
  });
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
  resetForm,
  onFormReset
}: UseBaseExerciseProps<T>) => {
  const [formData, setFormData] = useState<T>(() => {
    const mergedData = initialData
      ? {
          ...getDefaultFormData(),
          ...initialData
        }
      : getDefaultFormData();

    return {
      ...mergedData,
      // Ensure options have IDs if they are present
      optionList: handleOptionIds(mergedData.optionList)
    };
  });

  const [activeStep, setActiveStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [stepsVisited, setStepsVisited] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(steps.map((_, index) => [index, false]))
  );

  const [questionInteracted, setQuestionInteracted] = useState(false);
  const [settingsInteracted, setSettingsInteracted] = useState(false);

  useEffect(() => {
    if (resetForm && onFormReset) {
      setFormData(getDefaultFormData());
      setActiveStep(0);
      setIsSaving(false);
      setIsDirty(false);
      setQuestionInteracted(false);
      setSettingsInteracted(false);
      setStepsVisited(Object.fromEntries(steps.map((_, index) => [index, false])));
      onFormReset();
    }
  }, [resetForm, onFormReset, steps, getDefaultFormData]);

  const updateFormData = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
    setIsDirty(true);
  }, []);

  const handleSettingsChange = useCallback((settings: Partial<T>) => {
    setFormData((prev) => ({
      ...prev,
      ...settings
    }));
    setSettingsInteracted(true);
    setIsDirty(true);
  }, []);

  const handleQuestionChange = useCallback(
    (content: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateFormData("statement" as keyof T, content as any);
      setQuestionInteracted(true);
    },
    [updateFormData]
  );

  const isCurrentStepValid = useCallback(() => {
    return validateStep(activeStep, formData);
  }, [activeStep, formData, validateStep]);

  const goToNextStep = useCallback(() => {
    if (isCurrentStepValid()) {
      setStepsVisited((prev) => ({
        ...prev,
        [activeStep]: true
      }));
      setActiveStep((prev) => prev + 1);
    }
  }, [activeStep, isCurrentStepValid]);

  const goToPrevStep = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  }, [activeStep]);

  const generateHtmlPreview = useCallback(() => {
    try {
      return generatePreview(formData);
    } catch (error) {
      console.error("Error generating preview:", error);
      return "<div>Error generating preview</div>";
    }
  }, [formData, generatePreview]);

  const handleSave = useCallback(async () => {
    const errors = validateForm(formData);

    if (errors.length > 0) {
      errors.forEach((error) => notify.error(error));
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
      setIsSaving(false);
    }
  }, [validateForm, formData, steps, onSave, generateHtmlPreview, exerciseType]);

  return {
    formData,
    activeStep,
    isSaving,
    isDirty,
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
