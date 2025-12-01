import { ExerciseComponentProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateClickableAreaPreview } from "@/utils/preview/clickableArea";

import { CLICKABLE_AREA_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { validateCommonFields } from "../../utils/validation";

import { ClickableAreaEditor } from "./ClickableAreaEditor";
import { ClickableAreaExerciseSettings } from "./ClickableAreaExerciseSettings";
import { ClickableAreaPreview } from "./ClickableAreaPreview";

const CLICKABLE_AREA_STEPS = [{ label: "Content" }, { label: "Settings" }, { label: "Preview" }];

// Define the default form data
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
  question_type: "clickablearea",
  statement: "",
  feedback: ""
});

// Create a wrapper for generateClickableAreaPreview to match the expected type
const generatePreview = (data: Partial<CreateExerciseFormType>): string => {
  return generateClickableAreaPreview(
    data.questionText || "",
    data.name || "",
    data.feedback || "",
    data.statement || ""
  );
};

export const ClickableAreaExercise: FC<ExerciseComponentProps> = ({
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
    isCurrentStepValid,
    goToNextStep,
    goToPrevStep,
    handleSave: baseHandleSave,
    setActiveStep
  } = useBaseExercise({
    initialData,
    steps: CLICKABLE_AREA_STEPS,
    exerciseType: "clickablearea",
    generatePreview,
    validateStep: (step, data) => {
      const errors = CLICKABLE_AREA_STEP_VALIDATORS[step](data);

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
      stepValidators: CLICKABLE_AREA_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: CLICKABLE_AREA_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: generatePreview,
      updateFormData
    });

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Content
        return (
          <ClickableAreaEditor
            content={formData.questionText || ""}
            statement={formData.statement || ""}
            feedback={formData.feedback || ""}
            onChange={(content) => updateFormData("questionText", content)}
            onStatementChange={(statement) => updateFormData("statement", statement)}
            onFeedbackChange={(feedback) => updateFormData("feedback", feedback)}
          />
        );

      case 1: // Settings
        return (
          <ClickableAreaExerciseSettings formData={formData} onChange={handleSettingsChange} />
        );

      case 2: // Preview
        return (
          <ClickableAreaPreview
            content={formData.questionText || ""}
            name={formData.name || ""}
            feedback={formData.feedback || ""}
            statement={formData.statement || ""}
          />
        );

      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="Clickable Area Exercise"
      exerciseType="clickablearea"
      isEdit={isEdit}
      steps={CLICKABLE_AREA_STEPS}
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
