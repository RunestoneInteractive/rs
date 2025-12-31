import { ExerciseComponentProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { FC, useCallback } from "react";

import { useFetchDatafilesQuery } from "@/store/datafile/datafile.logic.api";
import { ExistingDataFile, SelectedDataFile } from "@/types/datafile";
import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateActiveCodePreview } from "@/utils/preview/activeCode";

import { ACTIVE_CODE_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { addLanguageTag } from "../../utils/tag";
import { validateCommonFields } from "../../utils/validation";

import { ActiveCodeExerciseSettings } from "./ActiveCodeExerciseSettings";
import { ActiveCodePreview } from "./ActiveCodePreview";
import { DataFilesEditor } from "./components/DataFilesEditor";
import { InstructionsEditor } from "./components/InstructionsEditor";
import { LanguageSelector } from "./components/LanguageSelector";
import { PrefixCodeEditor } from "./components/PrefixCodeEditor";
import { StarterCodeEditor } from "./components/StarterCodeEditor";
import { StdinEditor } from "./components/StdinEditor";
import { SuffixCodeEditor } from "./components/SuffixCodeEditor";

// Define the steps for ActiveCode exercise
const ACTIVE_CODE_STEPS = [
  { label: "Language" },
  { label: "Data Files" },
  { label: "Instructions" },
  { label: "Hidden Prefix" },
  { label: "Starter Code" },
  { label: "Hidden Suffix" },
  { label: "Standard Input" },
  { label: "Settings" },
  { label: "Preview" }
];

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
  question_type: "activecode",
  statement: "",
  starter_code: "",
  prefix_code: "",
  suffix_code: "",
  instructions: "",
  language: "",
  stdin: "",
  selectedExistingDataFiles: []
});

export const ActiveCodeExercise: FC<ExerciseComponentProps> = ({
  initialData,
  onSave,
  onCancel,
  resetForm,
  onFormReset,
  isEdit = false
}) => {
  const { data: allDatafiles = [] } = useFetchDatafilesQuery();

  const generatePreview = useCallback(
    (data: Partial<CreateExerciseFormType>): string => {
      const selectedFileAcids: SelectedDataFile[] = data.selectedExistingDataFiles || [];
      const selectedDatafilesInfo = selectedFileAcids
        .map((acid) => {
          const existingFile = allDatafiles.find((df: ExistingDataFile) => df.acid === acid);
          return {
            acid,
            filename: existingFile?.filename
          };
        })
        .filter((df) => df.acid);

      return generateActiveCodePreview(
        data.instructions || "",
        data.language || "python",
        data.prefix_code || "",
        data.starter_code || "",
        data.suffix_code || "",
        data.name || "",
        data.stdin || "",
        selectedDatafilesInfo
      );
    },
    [allDatafiles]
  );

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
    steps: ACTIVE_CODE_STEPS,
    exerciseType: "activecode",
    generatePreview,
    validateStep: (step, data) => {
      const errors = ACTIVE_CODE_STEP_VALIDATORS[step](data);

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

  const handleLanguageChange = (language: string) => {
    const updatedTags = addLanguageTag(formData.tags || "", language, formData.language);

    updateFormData("language", language);
    updateFormData("tags", updatedTags);
  };

  // Use our centralized navigation and validation hook
  const { validation, handleNext, handleStepSelect, handleSave, stepsValidity } =
    useExerciseStepNavigation({
      data: formData,
      activeStep,
      setActiveStep,
      stepValidators: ACTIVE_CODE_STEP_VALIDATORS,
      goToNextStep,
      goToPrevStep,
      steps: ACTIVE_CODE_STEPS,
      handleBaseSave: baseHandleSave,
      generateHtmlSrc: generatePreview,
      updateFormData
    });

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Language
        return (
          <LanguageSelector language={formData.language || ""} onChange={handleLanguageChange} />
        );

      case 1: // Data Files
        return (
          <DataFilesEditor
            selectedDataFiles={formData.selectedExistingDataFiles || []}
            onSelectedDataFilesChange={(files) =>
              updateFormData("selectedExistingDataFiles", files)
            }
          />
        );

      case 2: // Instructions
        return (
          <InstructionsEditor
            instructions={formData.instructions || ""}
            onChange={(instructions: string) => updateFormData("instructions", instructions)}
          />
        );

      case 3: // Hidden Prefix Code
        return (
          <PrefixCodeEditor
            prefixCode={formData.prefix_code || ""}
            onChange={(code: string) => updateFormData("prefix_code", code)}
            language={formData.language || "python"}
          />
        );

      case 4: // Starter Code
        return (
          <StarterCodeEditor
            starterCode={formData.starter_code || ""}
            onChange={(code: string) => updateFormData("starter_code", code)}
            language={formData.language || "python"}
          />
        );

      case 5: // Hidden Suffix Code
        return (
          <SuffixCodeEditor
            suffixCode={formData.suffix_code || ""}
            onChange={(code: string) => updateFormData("suffix_code", code)}
            language={formData.language || "python"}
          />
        );

      case 6: // Standard Input
        return (
          <StdinEditor
            stdin={formData.stdin || ""}
            onChange={(stdin: string) => updateFormData("stdin", stdin)}
          />
        );

      case 7: // Settings
        return <ActiveCodeExerciseSettings formData={formData} onChange={handleSettingsChange} />;

      case 8: // Preview
        return (
          <ActiveCodePreview
            instructions={formData.instructions || ""}
            starter_code={formData.starter_code || ""}
            language={formData.language || "python"}
            prefix_code={formData.prefix_code || ""}
            suffix_code={formData.suffix_code || ""}
            name={formData.name || ""}
            stdin={formData.stdin || ""}
            selectedExistingDataFiles={formData.selectedExistingDataFiles || []}
          />
        );

      default:
        return null;
    }
  };

  return (
    <ExerciseLayout
      title="Active Code Exercise"
      exerciseType="activecode"
      isEdit={isEdit}
      steps={ACTIVE_CODE_STEPS}
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
