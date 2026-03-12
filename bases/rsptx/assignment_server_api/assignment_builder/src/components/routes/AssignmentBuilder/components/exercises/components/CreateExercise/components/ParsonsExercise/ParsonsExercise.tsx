import React, { FC, useCallback, useState } from "react";

import { SelectButton } from "primereact/selectbutton";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";

import { CreateExerciseFormType } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateParsonsPreview, ParsonsBlock } from "@/utils/preview/parsonsPreview";

import { PARSONS_STEP_VALIDATORS } from "../../config/stepConfigs";
import { useBaseExercise } from "../../hooks/useBaseExercise";
import { useExerciseStepNavigation } from "../../hooks/useExerciseStepNavigation";
import { ExerciseLayout } from "../../shared/ExerciseLayout";
import { ExerciseComponentProps } from "../../types/ExerciseTypes";
import { addLanguageTag } from "../../utils/tag";
import { validateCommonFields } from "../../utils/validation";

import { ParsonsExerciseSettings } from "./ParsonsExerciseSettings";
import { ParsonsPreview } from "./ParsonsPreview";
import {
  ParsonsInstructions,
  ParsonsLanguageSelector,
  ParsonsBlocksManager,
  ParsonsOptions
} from "./components";
import { ParsonsExerciseTour } from "./components/ParsonsExerciseTour";
import parsonsStyles from "./components/ParsonsExercise.module.css";

export type ParsonsMode = "simple" | "enhanced";

const MODE_OPTIONS = [
  { label: "Simple", value: "simple" },
  { label: "Enhanced", value: "enhanced" }
];

const PARSONS_STEPS = [
  { label: "Language" },
  { label: "Instructions" },
  { label: "Code Blocks" },
  { label: "Settings" },
  { label: "Preview" }
];

export interface ParsonsData extends Partial<CreateExerciseFormType> {}

const getDefaultFormData = (): ParsonsData => ({
  name: createExerciseId(),
  author: "",
  topic: "",
  chapter: "",
  subchapter: "",
  tags: "",
  points: 1,
  difficulty: 3,
  htmlsrc: "",
  question_type: "parsonsprob",
  language: "",
  instructions: "",
  blocks: [{ id: `block-${Date.now()}`, content: "", indent: 0 }],
  adaptive: true,
  numbered: "left",
  noindent: false,
  grader: "line",
  orderMode: "random",
  customOrder: []
});

const generatePreview = (data: ParsonsData): string => {
  return generateParsonsPreview({
    instructions: data.instructions || "",
    blocks: data.blocks || [],
    name: data.name || "parsons_exercise",
    language: data.language || "python",
    adaptive: data.adaptive ?? true,
    numbered: data.numbered ?? "left",
    noindent: data.noindent ?? false,
    questionLabel: data.name,
    grader: data.grader ?? "line",
    orderMode: data.orderMode ?? "random",
    customOrder: data.customOrder
  });
};

const generateExerciseHtmlSrc = (data: ParsonsData): string => {
  return generateParsonsPreview({
    name: data.name || "parsons_exercise",
    instructions: data.instructions || "",
    blocks: data.blocks || [],
    language: data.language || "python",
    adaptive: data.adaptive ?? true,
    numbered: data.numbered ?? "left",
    noindent: data.noindent ?? false,
    questionLabel: data.name,
    grader: data.grader ?? "line",
    orderMode: data.orderMode ?? "random",
    customOrder: data.customOrder
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

  const handleBlocksUpdate = useCallback(
    (blocks: ParsonsBlock[]) => {
      updateFormData("blocks", blocks);
    },
    [updateFormData]
  );

  const handleLanguageChange = useCallback(
    (language: string) => {
      const updatedTags = addLanguageTag(formData.tags || "", language, formData.language);

      updateFormData("language", language);
      updateFormData("tags", updatedTags);
      updateFormData("blocks", [{ id: `block-${Date.now()}`, content: "", indent: 0 }]);
    },
    [updateFormData, formData.language, formData.tags]
  );

  const handleAddBlock = useCallback(() => {
    const newBlock: ParsonsBlock = {
      id: `block-${Date.now()}`,
      content: "",
      indent: 0
    };
    updateFormData("blocks", [...(formData.blocks || []), newBlock]);
  }, [updateFormData, formData.blocks]);

  // --- Mode switcher ---
  const isEnhancedExercise =
    isEdit &&
    (initialData?.grader === "dag" ||
      initialData?.orderMode === "custom" ||
      initialData?.numbered === "right" ||
      initialData?.numbered === "none" ||
      initialData?.noindent === true);

  const [mode, setMode] = useState<ParsonsMode>(isEnhancedExercise ? "enhanced" : "simple");

  const directSetMode = useCallback((newMode: ParsonsMode) => {
    setMode(newMode);
  }, []);

  const tourButton = (
    <ParsonsExerciseTour
      mode={mode}
      formData={formData}
      onModeChange={directSetMode}
      updateFormData={updateFormData as (key: string, value: any) => void}
    />
  );

  const handleModeChange = useCallback(
    (newMode: ParsonsMode) => {
      if (newMode === mode || !newMode) return;

      if (newMode === "simple") {
        // Enhanced → Simple: confirm and reset
        confirmDialog({
          message:
            "Switching to Simple Mode will reset Grader, Order, Line Numbers, and No Indent to their default values. Block dropdown settings (DAG tags, dependencies, custom order) will be cleared. Continue?",
          header: "Switch to Simple Mode",
          icon: "pi pi-exclamation-triangle",
          acceptClassName: "p-button-warning",
          accept: () => {
            // Reset locked fields
            updateFormData("grader", "line");
            updateFormData("orderMode", "random");
            updateFormData("numbered", "left");
            updateFormData("noindent", false);
            updateFormData("adaptive", true);
            updateFormData("customOrder", []);
            // Clear DAG / order block fields
            const clearedBlocks = (formData.blocks || []).map((block) => ({
              ...block,
              tag: undefined,
              depends: undefined,
              displayOrder: undefined
            }));
            updateFormData("blocks", clearedBlocks);
            setMode("simple");
          }
        });
      } else {
        // Simple → Enhanced: no data loss, just switch
        setMode("enhanced");
      }
    },
    [mode, updateFormData, formData.blocks]
  );

  const modeSwitcher = (
    <div className={parsonsStyles.modeSwitcher} data-tour="mode-switcher">
      <span className={parsonsStyles.modeSwitcherLabel}>Mode</span>
      <SelectButton
        value={mode}
        options={MODE_OPTIONS}
        onChange={(e) => handleModeChange(e.value)}
        className={parsonsStyles.modeSwitcherButton}
        allowEmpty={false}
      />
    </div>
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <ParsonsLanguageSelector
            language={formData.language || ""}
            onChange={handleLanguageChange}
          />
        );

      case 1:
        return (
          <ParsonsInstructions
            instructions={formData.instructions || ""}
            onChange={(instructions: string) => updateFormData("instructions", instructions)}
          />
        );

      case 2:
        return (
          <div className="flex flex-column gap-4">
            <ParsonsOptions
              adaptive={formData.adaptive ?? true}
              numbered={formData.numbered ?? "left"}
              noindent={formData.noindent ?? false}
              grader={formData.grader ?? "line"}
              orderMode={formData.orderMode ?? "random"}
              mode={mode}
              onAdaptiveChange={(value: boolean) => updateFormData("adaptive", value)}
              onNumberedChange={(value: "left" | "right" | "none") =>
                updateFormData("numbered", value)
              }
              onNoindentChange={(value: boolean) => updateFormData("noindent", value)}
              onGraderChange={(value: "line" | "dag") => {
                updateFormData("grader", value);
                if (value === "dag") {
                  updateFormData("adaptive", false);
                  // Auto-assign tags to blocks that don't have them
                  const updatedBlocks = (formData.blocks || []).map((block, idx) => {
                    if (!block.tag && !block.isDistractor && !block.groupId) {
                      return { ...block, tag: String(idx) };
                    }
                    return block;
                  });
                  updateFormData("blocks", updatedBlocks);
                }
              }}
              onOrderModeChange={(value: "random" | "custom") => updateFormData("orderMode", value)}
              onAddBlock={handleAddBlock}
              tourButton={tourButton}
            />
            <ParsonsBlocksManager
              blocks={formData.blocks || []}
              onChange={(blocks: ParsonsBlock[]) => updateFormData("blocks", blocks)}
              language={formData.language || "python"}
              grader={formData.grader ?? "line"}
              orderMode={formData.orderMode ?? "random"}
              mode={mode}
            />
          </div>
        );

      case 3:
        return <ParsonsExerciseSettings formData={formData} onChange={handleSettingsChange} />;

      case 4:
        return (
          <ParsonsPreview
            instructions={formData.instructions || ""}
            blocks={formData.blocks || []}
            language={formData.language || "python"}
            name={formData.name || ""}
            adaptive={formData.adaptive ?? true}
            numbered={formData.numbered ?? "left"}
            noindent={formData.noindent ?? false}
            questionLabel={formData.name}
            grader={formData.grader ?? "line"}
            orderMode={formData.orderMode ?? "random"}
            customOrder={formData.customOrder}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <ConfirmDialog />
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
        headerExtra={modeSwitcher}
      >
        {renderStepContent()}
      </ExerciseLayout>
    </>
  );
};
