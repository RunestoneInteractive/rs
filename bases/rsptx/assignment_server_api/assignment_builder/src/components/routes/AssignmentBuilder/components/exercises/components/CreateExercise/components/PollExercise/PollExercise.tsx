import { SCALE_CONFIG } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/constants";
import { BaseExerciseProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { PollType } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/PollTypes";
import { FC, useCallback, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { CreateExerciseFormType, Option } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generatePollPreview } from "@/utils/preview/poll";

import { useBaseExercise } from "../../hooks/useBaseExercise";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { QuestionEditor } from "../../shared/QuestionEditor";
import styles from "../../shared/styles/CreateExercise.module.css";
import { isTipTapContentEmpty, validateCommonFields } from "../../utils/validation";

import { PollExerciseSettings } from "./PollExerciseSettings";
import { PollOptions } from "./PollOptions";
import { PollPreview } from "./PollPreview";
import { PollTypeSelector } from "./PollTypeSelector";
import { ScaleSettings } from "./ScaleSettings";

const POLL_STEPS = [
  { label: "Question" },
  { label: "Poll Type" },
  { label: "Options" },
  { label: "Settings" },
  { label: "Preview" }
];

// Extend the Option interface to include an id property for internal use
export interface PollOption extends Option {
  id: string;
}

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
  question_type: "poll",
  statement: "",
  optionList: [
    { id: `option-${Date.now()}`, choice: "" } as PollOption,
    { id: `option-${Date.now() + 1}`, choice: "" } as PollOption
  ]
});

// Create a wrapper for generatePollPreview to match the expected type
const generatePreview = (data: Partial<CreateExerciseFormType>, pollType: PollType): string => {
  const optionStrings = (data.optionList || []).map((opt) => opt.choice);

  return generatePollPreview(data.statement || "", optionStrings, data.name || "", pollType);
};

export const PollExercise: FC<BaseExerciseProps> = ({
  initialData,
  onSave,
  onCancel,
  resetForm,
  onFormReset,
  isEdit = false
}) => {
  // Poll-specific state
  const [pollType, setPollType] = useState<PollType>(() => {
    // If editing, check if it's a scale type (all options are numbers)
    if (isEdit && Array.isArray(initialData?.optionList) && initialData.optionList.length > 0) {
      const allNumbers = initialData.optionList.every((opt) => !isNaN(Number(opt.choice)));

      return allNumbers ? "scale" : "options";
    }
    return "options";
  });

  const [scaleMax, setScaleMax] = useState<number>(() => {
    // If it's a scale, set the max to the number of options or the default
    if (pollType === "scale" && Array.isArray(initialData?.optionList)) {
      return Math.max(initialData.optionList.length || 0, SCALE_CONFIG.MIN);
    }
    return SCALE_CONFIG.DEFAULT;
  });

  // Validation for steps
  const validateStep = useCallback(
    (step: number, data: Partial<CreateExerciseFormType>) => {
      switch (step) {
        case 0:
          return !isTipTapContentEmpty(data.statement || "");
        case 1:
          return true; // Poll type is always valid
        case 2:
          return pollType === "scale"
            ? true
            : (data.optionList?.length || 0) >= 2 &&
                (data.optionList || []).every((opt) => !isTipTapContentEmpty(opt.choice));
        case 3:
          return Boolean(
            data.name?.trim() &&
              data.chapter &&
              data.points !== undefined &&
              data.points > 0 &&
              data.difficulty !== undefined
          );
        case 4:
          return true; // Preview is always valid
        default:
          return false;
      }
    },
    [pollType]
  );

  // Validate form including poll-specific fields
  const validateForm = useCallback(
    (data: Partial<CreateExerciseFormType>): string[] => {
      const errors = validateCommonFields(data);

      if (pollType === "options" && (!data.optionList || data.optionList.length < 2)) {
        errors.push("At least two options are required");
      }
      if (
        pollType === "options" &&
        data.optionList?.some((opt) => isTipTapContentEmpty(opt.choice))
      ) {
        errors.push("All options must have content");
      }
      if (pollType === "scale" && (scaleMax < SCALE_CONFIG.MIN || scaleMax > SCALE_CONFIG.MAX)) {
        errors.push(`Scale maximum must be between ${SCALE_CONFIG.MIN} and ${SCALE_CONFIG.MAX}`);
      }

      return errors;
    },
    [pollType, scaleMax]
  );

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
    steps: POLL_STEPS,
    exerciseType: "poll",
    generatePreview: (data) => generatePreview(data, pollType),
    validateStep,
    validateForm,
    getDefaultFormData,
    onSave: onSave as (data: Partial<CreateExerciseFormType>) => Promise<void>,
    onCancel,
    resetForm,
    onFormReset,
    isEdit
  });

  // Poll-specific handlers
  const handlePollTypeChange = useCallback(
    (newType: PollType) => {
      setPollType(newType);

      // Update options if changing to scale type
      if (newType === "scale" && pollType !== "scale") {
        // Create scale options
        const scaleOptions = Array.from({ length: scaleMax }, (_, i) => ({
          id: `option-scale-${Date.now()}-${i}`,
          choice: String(i + 1),
          feedback: "",
          correct: false
        })) as PollOption[];

        updateFormData("optionList", scaleOptions);
      }
      // Reset to default options when switching from scale to options
      else if (newType === "options" && pollType === "scale") {
        const defaultOptions = [
          { id: `option-${Date.now()}`, choice: "", feedback: "", correct: false },
          { id: `option-${Date.now() + 1}`, choice: "", feedback: "", correct: false }
        ] as PollOption[];

        updateFormData("optionList", defaultOptions);
      }
    },
    [pollType, scaleMax, updateFormData]
  );

  const handleScaleMaxChange = useCallback(
    (value: number) => {
      setScaleMax(value);

      // Update options based on new scale max
      const scaleOptions = Array.from({ length: value }, (_, i) => {
        // Preserve existing option if available
        const existingOption = formData.optionList?.[i] as PollOption | undefined;

        return {
          id: existingOption?.id || `option-scale-${Date.now()}-${i}`,
          choice: String(i + 1),
          feedback: existingOption?.feedback || "",
          correct: existingOption?.correct || false
        };
      }) as PollOption[];

      updateFormData("optionList", scaleOptions);
    },
    [formData.optionList, updateFormData]
  );

  const handleOptionsChange = useCallback(
    (options: PollOption[]) => {
      updateFormData("optionList", options);
    },
    [updateFormData]
  );

  // Compute steps validity for the layout
  const stepsValidity = useMemo(
    () => ({
      0: !isTipTapContentEmpty(formData.statement || ""),
      1: true,
      2:
        pollType === "scale"
          ? true
          : (formData.optionList?.length || 0) >= 2 &&
            (formData.optionList || []).every((opt) => !isTipTapContentEmpty(opt.choice)),
      3: Boolean(
        formData.name?.trim() &&
          formData.chapter &&
          formData.points !== undefined &&
          formData.points > 0 &&
          formData.difficulty !== undefined
      ),
      4: true
    }),
    [formData, pollType]
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
      case 0:
        return (
          <QuestionEditor
            title="Poll Question"
            helpText="Create a clear question that students will respond to with the poll options you'll define later."
            tipText="Tip: Be concise and specific with your question for better responses"
            content={formData.statement || ""}
            showValidation={stepsVisited[0] || questionInteracted}
            isContentEmpty={isTipTapContentEmpty(formData.statement || "")}
            onChange={handleQuestionChange}
            onFocus={() => setStepsVisited((prev) => ({ ...prev, 0: true }))}
          />
        );
      case 1:
        return <PollTypeSelector value={pollType} onChange={handlePollTypeChange} />;
      case 2:
        return pollType === "scale" ? (
          <ScaleSettings value={scaleMax} onChange={handleScaleMaxChange} />
        ) : (
          <div className={styles.optionsSection}>
            <PollOptions
              options={(formData.optionList || []) as PollOption[]}
              onChange={handleOptionsChange}
              showValidation={stepsVisited[2]}
            />
            {stepsVisited[2] &&
              ((formData.optionList || []).length < 2 ? (
                <div className={styles.validationError}>At least two options are required</div>
              ) : (
                (formData.optionList || []).some((opt) => isTipTapContentEmpty(opt.choice)) && (
                  <div className={styles.validationError}>All options must have content</div>
                )
              ))}
          </div>
        );
      case 3:
        return (
          <>
            <PollExerciseSettings
              initialData={formData}
              onSettingsChange={handleSettingsChange}
              showValidation={stepsVisited[3] || settingsInteracted}
            />
            {(stepsVisited[3] || settingsInteracted) &&
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
      case 4:
        return (
          <PollPreview
            question={formData.statement ?? ""}
            pollType={pollType}
            options={(formData.optionList || []) as PollOption[]}
            scaleMax={scaleMax}
            questionName={formData.name ?? ""}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="Poll Exercise"
      isEdit={isEdit}
      steps={POLL_STEPS}
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
