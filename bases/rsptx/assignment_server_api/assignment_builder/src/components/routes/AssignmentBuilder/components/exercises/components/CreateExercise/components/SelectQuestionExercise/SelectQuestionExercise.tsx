import { FC, useMemo, useRef } from "react";

import { CreateExerciseFormType } from "@/types/exercises";
import { QuestionWithLabel } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateSelectQuestionPreview } from "@/utils/preview/selectQuestionPreview";

import { SELECT_QUESTION_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { ExerciseComponentProps } from "../../types/ExerciseTypes";
import { validateCommonFields } from "../../utils/validation";

import { SelectQuestionExerciseSettings } from "./SelectQuestionExerciseSettings";
import { SelectQuestionPreview } from "./SelectQuestionPreview";
import { ABExperimentSettings, QuestionListEditor, ToggleOptionsSettings } from "./components";

const SELECT_QUESTION_STEPS = [
  { label: "Questions" },
  { label: "Interaction Mode" },
  { label: "Settings" },
  { label: "Preview" }
];

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
  question_type: "selectquestion",
  questionList: [],
  abExperimentName: "",
  toggleOptions: [],
  dataLimitBasecourse: false
});

const convertToStringArray = (questionListWithLabels: QuestionWithLabel[]): string[] => {
  return questionListWithLabels.map((q) => q.questionId);
};

export const SelectQuestionExercise: FC<ExerciseComponentProps> = ({
  initialData,
  onSave,
  onCancel,
  resetForm,
  onFormReset,
  isEdit = false
}) => {
  const questionLabelsRef = useRef<Map<string, string>>(new Map());

  const generatePreviewWithLabels = (data: Partial<CreateExerciseFormType>): string => {
    const stringList = data.questionList || [];
    const questionListWithLabels = stringList.map((questionId) => ({
      questionId,
      label: questionLabelsRef.current.get(questionId)
    }));

    return generateSelectQuestionPreview({
      name: data.name || "",
      questionList: questionListWithLabels,
      abExperimentName: data.abExperimentName,
      toggleOptions: data.toggleOptions,
      dataLimitBasecourse: data.dataLimitBasecourse
    });
  };

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
    steps: SELECT_QUESTION_STEPS,
    exerciseType: "selectquestion",
    generatePreview: generatePreviewWithLabels,
    validateStep: (step, data) => {
      const errors = SELECT_QUESTION_STEP_VALIDATORS[step](data);

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

  const { validation, handleNext, handleStepSelect, handleSave, stepsValidity } =
    useExerciseStepNavigation({
      data: formData,
      activeStep,
      setActiveStep,
      stepValidators: SELECT_QUESTION_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: SELECT_QUESTION_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: generatePreviewWithLabels,
      updateFormData
    });

  const safeQuestionList = useMemo(() => {
    const stringList = formData.questionList || [];

    return stringList.map((questionId) => ({
      questionId,
      label: questionLabelsRef.current.get(questionId)
    }));
  }, [formData.questionList]);

  const handleQuestionListChange = (questionList: QuestionWithLabel[]) => {
    questionLabelsRef.current.clear();
    questionList.forEach((q) => {
      if (q.label) {
        questionLabelsRef.current.set(q.questionId, q.label);
      }
    });

    const stringList = convertToStringArray(questionList);

    updateFormData("questionList", stringList);
  };

  const handleABExperimentChange = (experimentName: string) => {
    updateFormData("abExperimentName", experimentName);
  };

  const handleToggleOptionsChange = (options: string[]) => {
    updateFormData("toggleOptions", options);
  };

  const handleLimitBasecourseChange = (limit: boolean) => {
    updateFormData("dataLimitBasecourse", limit);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <div className="flex flex-column gap-4">
            <QuestionListEditor
              questionList={safeQuestionList}
              onChange={handleQuestionListChange}
              dataLimitBasecourse={formData.dataLimitBasecourse || false}
              onLimitBasecourseChange={handleLimitBasecourseChange}
            />

            <ABExperimentSettings
              experimentName={formData.abExperimentName || ""}
              onChange={handleABExperimentChange}
            />
          </div>
        );

      case 1:
        return (
          <ToggleOptionsSettings
            toggleOptions={formData.toggleOptions || []}
            onChange={handleToggleOptionsChange}
          />
        );

      case 2:
        return (
          <SelectQuestionExerciseSettings formData={formData} onChange={handleSettingsChange} />
        );

      case 3:
        return (
          <SelectQuestionPreview
            name={formData.name || ""}
            questionList={safeQuestionList}
            abExperimentName={formData.abExperimentName}
            toggleOptions={formData.toggleOptions}
            dataLimitBasecourse={formData.dataLimitBasecourse}
          />
        );

      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="Select Question Exercise"
      exerciseType="selectquestion"
      isEdit={isEdit}
      steps={SELECT_QUESTION_STEPS}
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
