import { BaseExerciseProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { FC, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateMultiChoicePreview } from "@/utils/preview/multichoice";

import { useBaseExercise } from "../../hooks/useBaseExercise";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { QuestionEditor } from "../../shared/QuestionEditor";
import styles from "../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty, validateCommonFields } from "../../utils/validation";

import { MultiChoiceExerciseSettings } from "./MultiChoiceExerciseSettings";
import { MultiChoiceOptions, OptionWithId } from "./MultiChoiceOptions";
import { MultiChoicePreview } from "./MultiChoicePreview";

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
const generatePreview = (data: Partial<CreateExerciseFormType>): string => {
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
  // Validation for steps
  const validateStep = useCallback((step: number, data: Partial<CreateExerciseFormType>) => {
    const hasCorrectOption = (data.optionList || []).some((option) => option.correct);

    switch (step) {
      case 0:
        return !isTipTapContentEmpty(data.statement || "");
      case 1:
        return (
          (data.optionList?.length || 0) >= 2 &&
          (data.optionList || []).every((opt) => !isTipTapContentEmpty(opt.choice)) &&
          hasCorrectOption
        );
      case 2:
        return Boolean(
          data.name?.trim() &&
            data.chapter &&
            data.points !== undefined &&
            data.points > 0 &&
            data.difficulty !== undefined
        );
      case 3:
        return true; // Preview is always valid
      default:
        return false;
    }
  }, []);

  // Validate form including multi-choice specific fields
  const validateForm = useCallback((data: Partial<CreateExerciseFormType>): string[] => {
    const errors = validateCommonFields(data);

    if (!data.optionList || data.optionList.length < 2) {
      errors.push("At least two options are required");
    }
    if (data.optionList?.some((opt) => isTipTapContentEmpty(opt.choice))) {
      errors.push("All options must have content");
    }
    if (!data.optionList?.some((option) => option.correct)) {
      errors.push("At least one option must be marked as correct");
    }

    return errors;
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
    steps: MULTI_CHOICE_STEPS,
    exerciseType: "mchoice",
    generatePreview,
    validateStep,
    validateForm,
    getDefaultFormData,
    onSave: onSave as (data: Partial<CreateExerciseFormType>) => Promise<void>,
    onCancel,
    resetForm,
    onFormReset,
    isEdit
  });

  // Multi-choice specific handlers
  const handleOptionsChange = useCallback(
    (options: OptionWithId[]) => {
      updateFormData("optionList", options);
    },
    [updateFormData]
  );

  // Compute steps validity for the layout
  const stepsValidity = useMemo(() => {
    const hasCorrectOption = (formData.optionList || []).some((option) => option.correct);

    return {
      0: !isTipTapContentEmpty(formData.statement || ""),
      1:
        (formData.optionList?.length || 0) >= 2 &&
        (formData.optionList || []).every((opt) => !isTipTapContentEmpty(opt.choice)) &&
        hasCorrectOption,
      2: Boolean(
        formData.name?.trim() &&
          formData.chapter &&
          formData.points !== undefined &&
          formData.points > 0 &&
          formData.difficulty !== undefined
      ),
      3: true
    };
  }, [formData]);

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
      case 0:
        return (
          <QuestionEditor
            title="Multiple Choice Question"
            helpText="Create a clear question for which students will select the correct answer(s) from the options you'll define in the next step."
            tipText="Tip: Be precise and avoid ambiguity in your question to test specific concepts"
            content={formData.statement || ""}
            showValidation={stepsVisited[0] || questionInteracted}
            isContentEmpty={isTipTapContentEmpty(formData.statement || "")}
            onChange={handleQuestionChange}
            onFocus={() => setStepsVisited((prev) => ({ ...prev, 0: true }))}
          />
        );
      case 1:
        const isNotEnoughOptions = (formData.optionList || []).length < 2;
        const notAllWithContent = (formData.optionList || []).some((opt) =>
          isTipTapContentEmpty(opt.choice)
        );
        const hasNoCorrectOption = !(formData.optionList || []).some((option) => option.correct);
        const isNotValid = isNotEnoughOptions || notAllWithContent || hasNoCorrectOption;

        return (
          <div className={styles.optionsSection}>
            <MultiChoiceOptions
              options={(formData.optionList || []) as OptionWithId[]}
              onChange={handleOptionsChange}
              showValidation={stepsVisited[1]}
            />
            {stepsVisited[1] && isNotValid && (
              <div className={styles.validationError}>
                {isNotEnoughOptions && <div>At least two options are required</div>}
                {notAllWithContent && <div>All options must have content</div>}
                {hasNoCorrectOption && <div>At least one option must be marked as correct</div>}
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <>
            <MultiChoiceExerciseSettings
              initialData={formData}
              onSettingsChange={handleSettingsChange}
              showValidation={stepsVisited[2] || settingsInteracted}
            />
            {(stepsVisited[2] || settingsInteracted) &&
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
      isEdit={isEdit}
      steps={MULTI_CHOICE_STEPS}
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
