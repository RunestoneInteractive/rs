import { FC, useCallback } from "react";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateFillInTheBlankPreview } from "@/utils/preview/fillInTheBlank";
import { buildQuestionJson } from "@/utils/questionJson";

import { FILL_IN_THE_BLANK_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { ExerciseComponentProps } from "../../types/ExerciseTypes";
import { validateCommonFields } from "../../utils/validation";

import { FillInTheBlankExerciseSettings } from "./FillInTheBlankExerciseSettings";
import { FillInTheBlankPreview } from "./FillInTheBlankPreview";
import { BlankManager, QuestionEditor } from "./components";
import { BlankWithFeedback, FillInTheBlankData, GraderType } from "./types";

const FILL_IN_THE_BLANK_STEPS = [
  { label: "Question" },
  { label: "Answer Fields" },
  { label: "Settings" },
  { label: "Preview" }
];

const getDefaultFormData = (): FillInTheBlankData => ({
  name: createExerciseId(),
  author: "",
  topic: "",
  chapter: "",
  subchapter: "",
  tags: "",
  points: 1,
  difficulty: 3,
  htmlsrc: "",
  question_type: "fillintheblank",
  questionText: "",
  blanks: [
    {
      id: `blank-${Date.now()}`,
      graderType: GraderType.STRING,
      exactMatch: "",
      correctFeedback: "Correct!",
      incorrectFeedback: "Incorrect, please try again."
    }
  ]
});

const generateExerciseHtmlSrc = (data: FillInTheBlankData): string => {
  return generateFillInTheBlankPreview({
    questionText: data.questionText || "",
    blanks: data.blanks || [],
    name: data.name || "",
    questionLabel: data.name
  });
};

export const FillInTheBlankExercise: FC<ExerciseComponentProps> = ({
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
  } = useBaseExercise<FillInTheBlankData>({
    initialData: initialData as FillInTheBlankData,
    steps: FILL_IN_THE_BLANK_STEPS,
    exerciseType: "fillintheblank",
    generatePreview: generateExerciseHtmlSrc,
    validateStep: (step, data) => {
      const errors = FILL_IN_THE_BLANK_STEP_VALIDATORS[step](data);

      return errors.length === 0;
    },
    validateForm: validateCommonFields,
    getDefaultFormData,
    onSave: async (data: FillInTheBlankData) => {
      const exerciseData = {
        ...data,
        question_json: buildQuestionJson(data as CreateExerciseFormType)
      };

      await (onSave as (data: Partial<CreateExerciseFormType>) => Promise<void>)(exerciseData);
    },
    onCancel,
    resetForm,
    onFormReset,
    isEdit
  });

  const { validation, handleNext, handleStepSelect, handleSave, stepsValidity } =
    useExerciseStepNavigation({
      data: formData,
      activeStep,
      setActiveStep,
      stepValidators: FILL_IN_THE_BLANK_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: FILL_IN_THE_BLANK_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: generateExerciseHtmlSrc,
      updateFormData
    });

  const handleQuestionTextChange = useCallback(
    (text: string) => {
      updateFormData("questionText", text);
    },
    [updateFormData]
  );

  const handleBlanksChange = useCallback(
    (blanks: BlankWithFeedback[]) => {
      updateFormData("blanks", blanks);
    },
    [updateFormData]
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <QuestionEditor
            questionText={formData.questionText || ""}
            onChange={handleQuestionTextChange}
          />
        );
      case 1:
        return (
          <BlankManager
            blanks={formData.blanks || []}
            onChange={handleBlanksChange}
            questionText={formData.questionText || ""}
          />
        );
      case 2:
        return (
          <FillInTheBlankExerciseSettings
            initialData={formData}
            onSettingsChange={handleSettingsChange}
          />
        );
      case 3:
        return (
          <FillInTheBlankPreview
            questionText={formData.questionText || ""}
            blanks={formData.blanks || []}
            name={formData.name || ""}
            questionLabel={formData.name}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="Fill in the Blank Exercise"
      exerciseType="fillintheblank"
      isEdit={isEdit}
      steps={FILL_IN_THE_BLANK_STEPS}
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
