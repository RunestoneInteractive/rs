import { ExerciseComponentProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateIframePreview } from "@/utils/preview/iframePreview";

import { IFRAME_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { validateCommonFields } from "../../utils/validation";

import { IframeExerciseSettings } from "./IframeExerciseSettings";
import { IframePreview } from "./IframePreview";
import { IframeUrlInput } from "./components/IframeUrlInput";

const IFRAME_STEPS = [{ label: "iFrame URL" }, { label: "Settings" }, { label: "Preview" }];

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
  question_type: "iframe",
  iframeSrc: ""
});

// Create a wrapper for generateIframePreview to match the expected type
const generatePreview = (data: Partial<CreateExerciseFormType>): string => {
  return generateIframePreview(data.iframeSrc || "", data.name || "");
};

export const IframeExercise: FC<ExerciseComponentProps> = ({
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
    steps: IFRAME_STEPS,
    exerciseType: "iframe",
    generatePreview,
    validateStep: (step, data) => {
      const errors = IFRAME_STEP_VALIDATORS[step](data);

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
      stepValidators: IFRAME_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: IFRAME_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: generatePreview,
      updateFormData
    });

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // iFrame URL
        return (
          <IframeUrlInput
            iframeSrc={formData.iframeSrc || ""}
            onChange={(url: string) => updateFormData("iframeSrc", url)}
          />
        );

      case 1: // Settings
        return <IframeExerciseSettings formData={formData} onChange={handleSettingsChange} />;

      case 2: // Preview
        return <IframePreview iframeSrc={formData.iframeSrc || ""} name={formData.name || ""} />;

      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="iFrame Exercise"
      exerciseType="iframe"
      isEdit={isEdit}
      steps={IFRAME_STEPS}
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
