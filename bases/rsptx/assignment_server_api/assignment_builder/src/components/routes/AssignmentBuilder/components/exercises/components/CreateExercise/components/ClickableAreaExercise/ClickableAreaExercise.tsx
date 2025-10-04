import { FC, useCallback } from "react";
import { InputTextarea } from "primereact/inputtextarea";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateClickableAreaPreview } from "@/utils/preview/clickableArea";
import { buildQuestionJson } from "@/utils/questionJson";

import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { ExerciseComponentProps } from "../../types/ExerciseTypes";
import { validateCommonFields } from "../../utils/validation";

import { ClickableAreaEditor } from "./ClickableAreaEditor";
import { ClickableAreaList } from "./ClickableAreaList";
import { ClickableAreaPreview } from "./ClickableAreaPreview";
import { ClickableAreaSettings } from "./ClickableAreaSettings";
import { ClickableArea, ClickableAreaData } from "./types";

const CLICKABLE_AREA_STEPS = [{ label: "Content" }, { label: "Settings" }, { label: "Preview" }];

const getDefaultFormData = (): ClickableAreaData => ({
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
  questionText: "",
  feedback: "",
  clickableAreas: []
});

const generateExerciseHtmlSrc = (data: ClickableAreaData): string => {
  return generateClickableAreaPreview({
    statement: data.statement || "",
    questionText: data.questionText || "",
    feedback: data.feedback || "",
    clickableAreas: data.clickableAreas || [],
    name: data.name || "",
    questionLabel: data.name
  });
};

const STEP_VALIDATORS = [
  (data: ClickableAreaData) => {
    const errors: string[] = [];
    if (!data.statement || data.statement.trim() === "") {
      errors.push("Statement/Question is required");
    }
    if (!data.questionText || data.questionText.trim() === "") {
      errors.push("Content is required");
    }
    if (!data.clickableAreas || data.clickableAreas.length === 0) {
      errors.push("At least one clickable area is required");
    }
    return errors;
  },
  () => {
    return [];
  },
  () => {
    return [];
  }
];

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
  } = useBaseExercise<ClickableAreaData>({
    initialData: initialData as ClickableAreaData,
    steps: CLICKABLE_AREA_STEPS,
    exerciseType: "clickablearea",
    generatePreview: generateExerciseHtmlSrc,
    validateStep: (step, data) => {
      const errors = STEP_VALIDATORS[step](data);
      return errors.length === 0;
    },
    validateForm: validateCommonFields,
    getDefaultFormData,
    onSave: async (data: ClickableAreaData) => {
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
      stepValidators: STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: CLICKABLE_AREA_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: generateExerciseHtmlSrc,
      updateFormData
    });

  const handleContentChange = useCallback(
    (text: string) => {
      updateFormData("questionText", text);
    },
    [updateFormData]
  );

  const handleStatementChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateFormData("statement", e.target.value);
    },
    [updateFormData]
  );

  const handleFeedbackChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateFormData("feedback", e.target.value);
    },
    [updateFormData]
  );

  const handleAddClickableArea = useCallback(
    (text: string, isCorrect: boolean, startOffset: number, endOffset: number) => {
      const existingAreas = formData.clickableAreas || [];
      const overlappingAreas = existingAreas.filter(
        (area) =>
          (startOffset >= area.startOffset && startOffset < area.endOffset) ||
          (endOffset > area.startOffset && endOffset <= area.endOffset) ||
          (startOffset <= area.startOffset && endOffset >= area.endOffset)
      );
      const newAreas = existingAreas.filter(
        (area) => !overlappingAreas.some((overlap) => overlap.id === area.id)
      );

      const newArea: ClickableArea = {
        id: `area-${Date.now()}`,
        text,
        isCorrect,
        startOffset,
        endOffset
      };

      const finalAreas = [...newAreas, newArea];

      // Use updateFormData to properly update the main form state
      updateFormData("clickableAreas", finalAreas);
    },
    [formData.clickableAreas, updateFormData]
  );

  const handleRemoveClickableArea = useCallback(
    (id: string) => {
      const newAreas = (formData.clickableAreas || []).filter((area) => area.id !== id);
      updateFormData("clickableAreas", newAreas);
    },
    [formData.clickableAreas, updateFormData]
  );

  const handleUpdateClickableAreas = useCallback(
    (updatedAreas: ClickableArea[]) => {
      updateFormData("clickableAreas", updatedAreas);
    },
    [updateFormData]
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question/Statement <span className="text-red-500">*</span>
              </label>
              <InputTextarea
                value={formData.statement || ""}
                onChange={handleStatementChange}
                rows={3}
                className="w-full"
                placeholder="Enter the question or instruction for students (e.g., 'Identify all of the nouns in this quotation by Eleanor Roosevelt.')"
              />
            </div>

            <div className="pb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Content <span className="text-red-500">*</span>
              </label>
              <ClickableAreaEditor
                content={formData.questionText || ""}
                onChange={handleContentChange}
                clickableAreas={formData.clickableAreas || []}
                onAddClickableArea={handleAddClickableArea}
                onUpdateClickableAreas={handleUpdateClickableAreas}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feedback (Optional)
              </label>
              <InputTextarea
                value={formData.feedback || ""}
                onChange={handleFeedbackChange}
                rows={3}
                className="w-full"
                placeholder="Enter feedback message for incorrect answers..."
              />
            </div>

            <ClickableAreaList
              areas={formData.clickableAreas || []}
              onRemove={handleRemoveClickableArea}
            />
          </div>
        );
      case 1:
        return (
          <ClickableAreaSettings initialData={formData} onSettingsChange={handleSettingsChange} />
        );
      case 2:
        return (
          <ClickableAreaPreview
            statement={formData.statement || ""}
            questionText={formData.questionText || ""}
            feedback={formData.feedback || ""}
            clickableAreas={formData.clickableAreas || []}
            name={formData.name || ""}
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
