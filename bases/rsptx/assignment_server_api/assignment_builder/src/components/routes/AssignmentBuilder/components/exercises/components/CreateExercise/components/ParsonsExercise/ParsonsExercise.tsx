import React, { FC, useCallback, useMemo } from "react";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateParsonsHtmlSrc } from "@/utils/exercise/parsonsExercise";
import { generateParsonsPreview, ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { PARSONS_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { ExerciseComponentProps } from "../../types/ExerciseTypes";
import { validateCommonFields } from "../../utils/validation";

import { ParsonsExerciseSettings } from "./ParsonsExerciseSettings";
import { ParsonsPreview } from "./ParsonsPreview";
import { ParsonsInstructions, ParsonsLanguageSelector, ParsonsBlocksManager } from "./components";

const PARSONS_STEPS = [
  { label: "Language" },
  { label: "Instructions" },
  { label: "Code Blocks" },
  { label: "Settings" },
  { label: "Preview" }
];

export interface ParsonsData extends Partial<CreateExerciseFormType> {
  blocks?: ParsonsBlock[];
  language?: string;
  instructions?: string;
}

const getDefaultFormData = (): ParsonsData => ({
  name: createExerciseId(),
  author: "",
  topic: "",
  chapter: "",
  tags: "",
  points: 1,
  difficulty: 3,
  htmlsrc: "",
  question_type: "parsonsprob",
  language: "",
  instructions: "",
  blocks: [{ id: `block-${Date.now()}`, content: "", indent: 0 }]
});

const generatePreview = (data: ParsonsData): string => {
  return generateParsonsPreview({
    instructions: data.instructions || "",
    blocks: data.blocks || [],
    name: data.name || "parsons_exercise",
    language: data.language || "python",
    // Set hardcoded defaults for Parsons exercises
    adaptive: true, // Always provide feedback
    numbered: "left", // Always show line numbers on the left
    noindent: false, // Always allow indentation
    questionLabel: data.name // Use name as the question label
  });
};

const generateExerciseHtmlSrc = (data: ParsonsData): string => {
  return generateParsonsHtmlSrc({
    name: data.name || "parsons_exercise",
    instructions: data.instructions || "",
    blocks: data.blocks || [],
    language: data.language || "python",
    // Set hardcoded defaults for Parsons exercises
    adaptive: true, // Always provide feedback
    numbered: "left", // Always show line numbers on the left
    noindent: false, // Always allow indentation
    questionLabel: data.name // Use name as the question label
  });
};

export const ParsonsExercise: FC<ExerciseComponentProps> = ({
  initialData,
  onSave,
  onCancel,
  resetForm,
  onFormReset,
  isEdit = false
}) => {
  const validateStep = useCallback((step: number, data: ParsonsData) => {
    // Use the validator functions to determine validity
    const errors = PARSONS_STEP_VALIDATORS[step](data);

    return errors.length === 0;
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
    isCurrentStepValid,
    goToNextStep,
    goToPrevStep,
    handleSave: baseHandleSave,
    setStepsVisited,
    setActiveStep
  } = useBaseExercise<ParsonsData>({
    initialData: initialData as ParsonsData,
    steps: PARSONS_STEPS,
    exerciseType: "parsonsprob",
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

  // Use our centralized navigation and validation hook
  const { validation, handleNext, handleStepSelect, handleSave, stepsValidity } =
    useExerciseStepNavigation({
      data: formData,
      activeStep,
      setActiveStep,
      stepValidators: PARSONS_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: PARSONS_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: generateExerciseHtmlSrc,
      updateFormData
    });

  // Handler for updating blocks
  const handleBlocksUpdate = useCallback(
    (blocks: ParsonsBlock[]) => {
      updateFormData("blocks", blocks);
    },
    [updateFormData]
  );

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Language
        return (
          <ParsonsLanguageSelector
            language={formData.language || ""}
            onChange={(language: string) => updateFormData("language", language)}
          />
        );

      case 1: // Instructions
        return (
          <ParsonsInstructions
            instructions={formData.instructions || ""}
            onChange={(instructions: string) => updateFormData("instructions", instructions)}
          />
        );

      case 2: // Code Blocks
        return (
          <ParsonsBlocksManager
            blocks={formData.blocks || []}
            onChange={(blocks: ParsonsBlock[]) => updateFormData("blocks", blocks)}
            language={formData.language || "python"}
          />
        );

      case 3: // Settings
        return <ParsonsExerciseSettings formData={formData} onChange={handleSettingsChange} />;

      case 4: // Preview
        return (
          <ParsonsPreview
            instructions={formData.instructions || ""}
            blocks={formData.blocks || []}
            language={formData.language || "python"}
            name={formData.name || ""}
            adaptive={true}
            numbered="left"
            noindent={false}
            questionLabel={formData.name}
          />
        );

      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="Parsons Exercise"
      exerciseType="parsonsprob"
      isEdit={isEdit}
      steps={PARSONS_STEPS}
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
