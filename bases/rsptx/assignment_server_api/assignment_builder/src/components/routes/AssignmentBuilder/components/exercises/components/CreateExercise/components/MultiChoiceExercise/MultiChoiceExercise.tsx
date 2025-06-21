import { BaseExerciseProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { FC, useCallback } from "react";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateMultiChoicePreview } from "@/utils/preview/multichoice";

import { MULTI_CHOICE_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { validateCommonFields } from "../../utils/validation";

import { MultiChoiceExerciseSettings } from "./MultiChoiceExerciseSettings";
import { OptionWithId } from "./MultiChoiceOptions";
import { MultiChoicePreview } from "./MultiChoicePreview";
import { MultiChoiceQuestion, MultiChoiceOptionsWrapper } from "./components";

const MULTI_CHOICE_STEPS = [
  { label: "Question" },
  { label: "Options" },
  { label: "Settings" },
  { label: "Preview" }
];

// Define the default form data with partial Exercise properties
const getDefaultFormData = (): Partial<CreateExerciseFormType> => ({
  name: createExerciseId(),
  author: "",
  topic: "",
  chapter: "",
  subchapter: "",
  tags: "",
  points: 1,
  difficulty: 3,
  htmlsrc: "",
  question_type: "mchoice",
  statement: "",
  optionList: [
    { id: `option-${Date.now()}`, choice: "", feedback: "", correct: false } as OptionWithId,
    { id: `option-${Date.now() + 1}`, choice: "", feedback: "", correct: false } as OptionWithId
  ]
});

// Create a wrapper for generateMultiChoicePreview to match the expected type
const generateExerciseHtmlSrc = (data: Partial<CreateExerciseFormType>): string => {
  return generateMultiChoicePreview(
    data.statement || "",
    (data.optionList || []) as OptionWithId[],
    data.name || ""
  );
};

export const MultiChoiceExercise: FC<BaseExerciseProps> = ({
  initialData,
  onSave,
  onCancel,
  resetForm,
  onFormReset,
  isEdit = false
}) => {
  const {
    formData,
    activeStep,
    isSaving,
    updateFormData,
    handleSettingsChange,
    handleQuestionChange,
    isCurrentStepValid,
    goToNextStep,
    goToPrevStep,
    handleSave: baseHandleSave,
    setActiveStep
  } = useBaseExercise({
    initialData,
    steps: MULTI_CHOICE_STEPS,
    exerciseType: "mchoice",
    generatePreview: generateExerciseHtmlSrc,
    validateStep: (step, data) => {
      const errors = MULTI_CHOICE_STEP_VALIDATORS[step](data);

      return errors.length === 0;
    },
    validateForm: validateCommonFields,
    getDefaultFormData,
    onSave: onSave as (data: Partial<CreateExerciseFormType>) => Promise<void>,
    onCancel,
    resetForm,
    onFormReset,
    isEdit
  });

  // Use our centralized navigation and validation hook
  const { validation, handleNext, handleStepSelect, handleSave, stepsValidity } =
    useExerciseStepNavigation({
      data: formData,
      activeStep,
      setActiveStep,
      stepValidators: MULTI_CHOICE_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: MULTI_CHOICE_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: generateExerciseHtmlSrc,
      updateFormData
    });

  // Multi-choice specific handlers
  const handleOptionsChange = useCallback(
    (options: OptionWithId[]) => {
      updateFormData("optionList", options);
    },
    [updateFormData]
  );

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <MultiChoiceQuestion
            content={formData.statement || ""}
            onChange={handleQuestionChange}
            onFocus={() => {}}
          />
        );
      case 1:
        return (
          <MultiChoiceOptionsWrapper
            options={(formData.optionList || []) as OptionWithId[]}
            onChange={handleOptionsChange}
          />
        );
      case 2:
        return (
          <MultiChoiceExerciseSettings
            initialData={formData}
            onSettingsChange={handleSettingsChange}
          />
        );
      case 3:
        return (
          <MultiChoicePreview
            question={formData.statement || ""}
            options={(formData.optionList || []) as OptionWithId[]}
            questionName={formData.name || ""}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="Multiple Choice Exercise"
      exerciseType="mchoice"
      isEdit={isEdit}
      steps={MULTI_CHOICE_STEPS}
      activeStep={activeStep}
      isCurrentStepValid={isCurrentStepValid}
      isSaving={isSaving}
      stepsValidity={stepsValidity}
      onCancel={onCancel}
      onBack={goToPrevStep}
      onNext={handleNext}
      onSave={handleSave}
      onStepSelect={handleStepSelect}
      validation={validation}
    >
      {renderStepContent()}
    </ExerciseLayout>
  );
};
