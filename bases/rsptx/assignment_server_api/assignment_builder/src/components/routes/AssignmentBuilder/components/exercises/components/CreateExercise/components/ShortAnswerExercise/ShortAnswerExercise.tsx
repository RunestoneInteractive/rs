import { ExerciseComponentProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { FC } from "react";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateShortAnswerPreview } from "@/utils/preview/shortAnswer";

import { SHORT_ANSWER_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { validateCommonFields } from "../../utils/validation";

import { ShortAnswerExerciseSettings } from "./ShortAnswerExerciseSettings";
import { ShortAnswerPreview } from "./ShortAnswerPreview";
import { ShortAnswerInstructions } from "./components";

const SHORT_ANSWER_STEPS = [{ label: "Question" }, { label: "Settings" }, { label: "Preview" }];

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
  question_type: "shortanswer",
  statement: "",
  attachment: false
});

// Create a wrapper for generateShortAnswerPreview to match the expected type
const generatePreview = (data: Partial<CreateExerciseFormType>): string => {
  return generateShortAnswerPreview(data.statement || "", !!data.attachment, data.name || "");
};

export const ShortAnswerExercise: FC<ExerciseComponentProps> = ({
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
    steps: SHORT_ANSWER_STEPS,
    exerciseType: "shortanswer",
    generatePreview,
    validateStep: (step, data) => {
      const errors = SHORT_ANSWER_STEP_VALIDATORS[step](data);

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
      stepValidators: SHORT_ANSWER_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: SHORT_ANSWER_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: generatePreview,
      updateFormData
    });

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Question
        return (
          <ShortAnswerInstructions
            instructions={formData.statement || ""}
            onChange={handleQuestionChange}
            attachment={!!formData.attachment}
            onAttachmentChange={(checked) => updateFormData("attachment", checked)}
          />
        );

      case 1: // Settings
        return <ShortAnswerExerciseSettings formData={formData} onChange={handleSettingsChange} />;

      case 2: // Preview
        return (
          <ShortAnswerPreview
            statement={formData.statement || ""}
            attachment={formData.attachment || false}
            name={formData.name || ""}
          />
        );

      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="Short Answer Exercise"
      exerciseType="shortanswer"
      isEdit={isEdit}
      steps={SHORT_ANSWER_STEPS}
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
