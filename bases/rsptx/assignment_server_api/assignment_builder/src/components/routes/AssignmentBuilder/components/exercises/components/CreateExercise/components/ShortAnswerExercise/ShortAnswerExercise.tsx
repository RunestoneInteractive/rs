import { ExerciseComponentProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { Checkbox } from "primereact/checkbox";
import { FC, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateShortAnswerPreview } from "@/utils/preview/shortAnswer";

import { useBaseExercise } from "../../hooks/useBaseExercise";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { QuestionEditor } from "../../shared/QuestionEditor";
import styles from "../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty, validateCommonFields } from "../../utils/validation";

import { ShortAnswerExerciseSettings } from "./ShortAnswerExerciseSettings";
import { ShortAnswerPreview } from "./ShortAnswerPreview";

const SHORT_ANSWER_STEPS = [{ label: "Question" }, { label: "Settings" }, { label: "Preview" }];

// Define the default form data
const getDefaultFormData = (): Partial<CreateExerciseFormType> => ({
  name: createExerciseId(),
  author: "",
  topic: "",
  chapter: "",
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
  // Validation for steps
  const validateStep = useCallback((step: number, data: Partial<CreateExerciseFormType>) => {
    switch (step) {
      case 0:
        return !isTipTapContentEmpty(data.statement || "");
      case 1:
        return Boolean(
          data.name?.trim() &&
            data.chapter &&
            data.points !== undefined &&
            data.points > 0 &&
            data.difficulty !== undefined
        );
      case 2:
        return true; // Preview is always valid
      default:
        return false;
    }
  }, []);

  const {
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
  } = useBaseExercise({
    initialData,
    steps: SHORT_ANSWER_STEPS,
    exerciseType: "shortanswer",
    generatePreview,
    validateStep,
    validateForm: validateCommonFields,
    getDefaultFormData,
    onSave: onSave as (data: Partial<CreateExerciseFormType>) => Promise<void>,
    onCancel,
    resetForm,
    onFormReset,
    isEdit
  });

  // Compute steps validity for the layout
  const stepsValidity = useMemo(
    () => ({
      0: !isTipTapContentEmpty(formData.statement || ""),
      1: Boolean(
        formData.name?.trim() &&
          formData.chapter &&
          formData.points !== undefined &&
          formData.points > 0 &&
          formData.difficulty !== undefined
      ),
      2: true
    }),
    [formData]
  );

  // Handle step selection
  const handleStepSelect = useCallback(
    (index: number) => {
      setStepsVisited((prev) => ({
        ...prev,
        [activeStep]: true
      }));

      const canAccess =
        index === 0 || // Always can go to first step
        index < activeStep || // Can go back
        (index === activeStep + 1 && isCurrentStepValid()); // Can go forward if current is valid

      if (canAccess) {
        setActiveStep(index);
      } else {
        toast.error("Please complete the current step before proceeding");
      }
    },
    [activeStep, isCurrentStepValid, setStepsVisited, setActiveStep]
  );

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Question
        return (
          <QuestionEditor
            title="Short Answer Question"
            helpText="Create a question that students will answer with a short text response."
            tipText="Tip: Be concise and specific with your question for better responses"
            content={formData.statement || ""}
            showValidation={stepsVisited[0] || questionInteracted}
            isContentEmpty={isTipTapContentEmpty(formData.statement || "")}
            onChange={handleQuestionChange}
            onFocus={() => setStepsVisited((prev) => ({ ...prev, 0: true }))}
            extraContent={
              <div className="flex align-items-center">
                <Checkbox
                  inputId="allowAttachments"
                  checked={formData.attachment || false}
                  onChange={(e) => updateFormData("attachment", e.checked)}
                />
                <label htmlFor="allowAttachments" className="ml-2 cursor-pointer">
                  Allow file attachments (students can upload files with their answers)
                </label>
              </div>
            }
          />
        );

      case 1: // Settings
        return (
          <>
            <ShortAnswerExerciseSettings
              formData={formData}
              onChange={handleSettingsChange}
              showValidation={stepsVisited[1] || settingsInteracted}
            />
            {(stepsVisited[1] || settingsInteracted) &&
              (!formData.name?.trim() ||
                !formData.chapter ||
                formData.points === undefined ||
                formData.points <= 0 ||
                formData.difficulty === undefined) && (
                <div className={styles.validationError}>
                  {!formData.name?.trim() && <div>Exercise name is required</div>}
                  {!formData.chapter && <div>Chapter is required</div>}
                  {(formData.points === undefined || formData.points <= 0) && (
                    <div>Points must be greater than 0</div>
                  )}
                  {formData.difficulty === undefined && <div>Difficulty is required</div>}
                </div>
              )}
          </>
        );

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
      isEdit={isEdit}
      steps={SHORT_ANSWER_STEPS}
      activeStep={activeStep}
      isCurrentStepValid={isCurrentStepValid}
      isSaving={isSaving}
      stepsValidity={stepsValidity}
      onCancel={onCancel}
      onBack={goToPrevStep}
      onNext={goToNextStep}
      onSave={handleSave}
      onStepSelect={handleStepSelect}
    >
      {renderStepContent()}
    </ExerciseLayout>
  );
};
