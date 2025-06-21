import { SCALE_CONFIG } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/constants";
import { BaseExerciseProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { PollType } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/PollTypes";
import { FC, useCallback, useState } from "react";

import { CreateExerciseFormType, Option } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generatePollPreview } from "@/utils/preview/poll";

import { POLL_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { validateCommonFields } from "../../utils/validation";

import { PollExerciseSettings } from "./PollExerciseSettings";
import { PollOptions } from "./PollOptions";
import { PollPreview } from "./PollPreview";
import { PollTypeSelector } from "./PollTypeSelector";
import { ScaleSettings } from "./ScaleSettings";
import { PollQuestionEditor } from "./components";

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
  subchapter: "",
  tags: "",
  points: 1,
  difficulty: 3,
  htmlsrc: "",
  question_type: "poll",
  statement: "",
  poll_type: "options",
  scale_min: 1,
  scale_max: SCALE_CONFIG.DEFAULT,
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
    if (isEdit && initialData?.poll_type) {
      return initialData.poll_type as PollType;
    }
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
    steps: POLL_STEPS,
    exerciseType: "poll",
    generatePreview: (data) => generatePreview(data, pollType),
    validateStep: (step, data) => {
      const errors = POLL_STEP_VALIDATORS[step](data);

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
      stepValidators: POLL_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: POLL_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: (data) => generatePreview(data, pollType),
      updateFormData
    });

  // Poll-specific handlers
  const handlePollTypeChange = useCallback(
    (newType: PollType) => {
      setPollType(newType);
      updateFormData("poll_type", newType);

      // Update options if changing to scale type
      if (newType === "scale" && pollType !== "scale") {
        updateFormData("scale_min", 1);
        updateFormData("scale_max", scaleMax);

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
        updateFormData("scale_min", undefined);
        updateFormData("scale_max", undefined);

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

      updateFormData("scale_min", 1);
      updateFormData("scale_max", value);

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

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <PollQuestionEditor question={formData.statement || ""} onChange={handleQuestionChange} />
        );
      case 1:
        return <PollTypeSelector value={pollType} onChange={handlePollTypeChange} />;
      case 2:
        return pollType === "scale" ? (
          <ScaleSettings value={scaleMax} onChange={handleScaleMaxChange} />
        ) : (
          <PollOptions
            options={(formData.optionList || []) as PollOption[]}
            onChange={handleOptionsChange}
          />
        );
      case 3:
        return <PollExerciseSettings initialData={formData} onChange={handleSettingsChange} />;
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
      exerciseType="poll"
      isEdit={isEdit}
      steps={POLL_STEPS}
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
