import { ExerciseComponentProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { FC, useCallback, useMemo } from "react";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateActiveCodePreview } from "@/utils/preview/activeCode";

import { useBaseExercise } from "../../hooks/useBaseExercise";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import styles from "../../shared/styles/CreateExercise.module.css";
import { validateCommonFields } from "../../utils/validation";

import { ActiveCodeExerciseSettings } from "./ActiveCodeExerciseSettings";
import { ActiveCodePreview } from "./ActiveCodePreview";
import { InstructionsEditor } from "./components/InstructionsEditor";
import { LanguageSelector } from "./components/LanguageSelector";
import { PrefixCodeEditor } from "./components/PrefixCodeEditor";
import { StarterCodeEditor } from "./components/StarterCodeEditor";
import { SuffixCodeEditor } from "./components/SuffixCodeEditor";

// Define the steps for ActiveCode exercise
const ACTIVE_CODE_STEPS = [
  { label: "Language" },
  { label: "Instructions" },
  { label: "Hidden Prefix" },
  { label: "Starter Code" },
  { label: "Hidden Suffix" },
  { label: "Settings" },
  { label: "Preview" }
];

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
  question_type: "activecode",
  statement: "",
  starter_code: "",
  prefix_code: "",
  suffix_code: "",
  instructions: "",
  language: ""
});

// Create a wrapper for generateActiveCodePreview to match the expected type
const generatePreview = (data: Partial<CreateExerciseFormType>): string => {
  return generateActiveCodePreview(
    data.instructions || "",
    data.starter_code || "",
    data.language || "python",
    data.prefix_code || "",
    data.suffix_code || "",
    data.name || ""
  );
};

export const ActiveCodeExercise: FC<ExerciseComponentProps> = ({
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
      case 0: // Language
        return Boolean(data.language);
      case 1: // Instructions
        return Boolean(data.instructions?.trim());
      case 2: // Hidden Prefix Code
        return true; // Optional
      case 3: // Starter Code
        return Boolean(data.starter_code !== undefined);
      case 4: // Hidden Suffix Code
        return true; // Optional
      case 5: // Settings
        return Boolean(
          data.name?.trim() &&
            data.chapter &&
            data.points !== undefined &&
            data.points > 0 &&
            data.difficulty !== undefined
        );
      case 6: // Preview
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
    isCurrentStepValid,
    goToNextStep,
    goToPrevStep,
    handleSave,
    setStepsVisited,
    setActiveStep
  } = useBaseExercise({
    initialData,
    steps: ACTIVE_CODE_STEPS,
    exerciseType: "activecode",
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

  // Calculate step validity
  const stepsValidity = useMemo(() => {
    return ACTIVE_CODE_STEPS.map((_, index) => validateStep(index, formData));
  }, [formData, validateStep]);

  const handleStepSelect = (index: number) => {
    if (index < activeStep) {
      setActiveStep(index);
    } else if (stepsValidity[activeStep]) {
      setActiveStep(index);
    }
    setStepsVisited({ ...stepsVisited, [activeStep]: true });
  };

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Language
        return (
          <LanguageSelector
            language={formData.language || ""}
            onChange={(language: string) => updateFormData("language", language)}
            showValidation={stepsVisited[0] || questionInteracted}
          />
        );

      case 1: // Instructions
        return (
          <InstructionsEditor
            instructions={formData.instructions || ""}
            onChange={(instructions: string) => updateFormData("instructions", instructions)}
            showValidation={stepsVisited[1] || questionInteracted}
          />
        );

      case 2: // Hidden Prefix Code
        return (
          <PrefixCodeEditor
            prefixCode={formData.prefix_code || ""}
            onChange={(code: string) => updateFormData("prefix_code", code)}
            language={formData.language || "python"}
          />
        );

      case 3: // Starter Code
        return (
          <StarterCodeEditor
            starterCode={formData.starter_code || ""}
            onChange={(code: string) => updateFormData("starter_code", code)}
            language={formData.language || "python"}
            showValidation={stepsVisited[3] || questionInteracted}
          />
        );

      case 4: // Hidden Suffix Code
        return (
          <SuffixCodeEditor
            suffixCode={formData.suffix_code || ""}
            onChange={(code: string) => updateFormData("suffix_code", code)}
            language={formData.language || "python"}
          />
        );

      case 5: // Settings
        return (
          <>
            <ActiveCodeExerciseSettings
              formData={formData}
              onChange={handleSettingsChange}
              showValidation={stepsVisited[5] || settingsInteracted}
            />
            {(stepsVisited[5] || settingsInteracted) &&
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

      case 6: // Preview
        return (
          <ActiveCodePreview
            instructions={formData.instructions || ""}
            starter_code={formData.starter_code || ""}
            language={formData.language || "python"}
            prefix_code={formData.prefix_code || ""}
            suffix_code={formData.suffix_code || ""}
            name={formData.name || ""}
          />
        );

      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="Active Code Exercise"
      isEdit={isEdit}
      steps={ACTIVE_CODE_STEPS}
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
