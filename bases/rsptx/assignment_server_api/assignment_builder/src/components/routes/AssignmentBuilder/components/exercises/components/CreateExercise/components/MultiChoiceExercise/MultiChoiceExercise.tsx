import { BaseExerciseProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { Button } from "primereact/button";
import { Steps } from "primereact/steps";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { CreateExerciseFormType, Option } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generateMultiChoicePreview } from "@/utils/preview/multichoice";

import styles from "../../shared/styles/CreateExercise.module.css";

import { MultiChoiceExerciseSettings } from "./MultiChoiceExerciseSettings";
import { MultiChoiceOptions, isTipTapContentEmpty, OptionWithId } from "./MultiChoiceOptions";
import { MultiChoicePreview } from "./MultiChoicePreview";

const MULTI_CHOICE_STEPS = [
  { label: "Question" },
  { label: "Options" },
  { label: "Settings" },
  { label: "Preview" }
];

// Create a type for step validation
type StepValidation = Record<number, boolean>;

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

export const MultiChoiceExercise = ({
  initialData,
  onSave,
  onCancel,
  resetForm,
  onFormReset,
  isEdit = false
}: BaseExerciseProps) => {
  // Initialize form data with defaults or initialData
  const [formData, setFormData] = useState<Partial<CreateExerciseFormType>>(() => {
    if (initialData) {
      return {
        ...getDefaultFormData(),
        ...initialData,
        // Ensure optionList has id property for internal tracking
        optionList: Array.isArray(initialData.optionList)
          ? (initialData.optionList.map((option: Option, index: number) => ({
              ...option,
              id: (option as OptionWithId).id || `option-${Date.now()}-${index}`
            })) as OptionWithId[])
          : getDefaultFormData().optionList
      };
    }
    return getDefaultFormData();
  });

  // UI state for the wizard
  const [activeStep, setActiveStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Track which steps have been visited or attempted
  const [stepsVisited, setStepsVisited] = useState<StepValidation>({
    0: false,
    1: false,
    2: false,
    3: false
  });

  // Track if fields have been interacted with (for showing validation)
  const [questionInteracted, setQuestionInteracted] = useState(false);
  const [optionsInteracted, setOptionsInteracted] = useState(false);
  const [settingsInteracted, setSettingsInteracted] = useState(false);

  // Reset form when resetForm is true
  useEffect(() => {
    if (resetForm && onFormReset) {
      setFormData(getDefaultFormData());
      setActiveStep(0);
      setIsSaving(false);

      // Reset interaction flags
      setQuestionInteracted(false);
      setOptionsInteracted(false);
      setSettingsInteracted(false);

      // Reset visited steps
      setStepsVisited({
        0: false,
        1: false,
        2: false,
        3: false
      });

      onFormReset();
    }
  }, [resetForm, onFormReset]);

  // Update form data field
  const updateFormData = useCallback(
    <K extends keyof CreateExerciseFormType>(field: K, value: CreateExerciseFormType[K]) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value
      }));
    },
    []
  );

  // Handle settings changes
  const handleSettingsChange = useCallback((settings: Partial<CreateExerciseFormType>) => {
    setFormData((prev) => ({
      ...prev,
      ...settings
    }));
    setSettingsInteracted(true);
  }, []);

  // Handle question content change
  const handleQuestionChange = useCallback(
    (content: string) => {
      updateFormData("statement", content);
      setQuestionInteracted(true);
    },
    [updateFormData]
  );

  // Handle options change
  const handleOptionsChange = useCallback(
    (options: OptionWithId[]) => {
      updateFormData("optionList", options);
      setOptionsInteracted(true);
    },
    [updateFormData]
  );

  // Check if at least one option is marked as correct
  const hasCorrectOption = useMemo(() => {
    return (formData.optionList || []).some((option) => option.correct);
  }, [formData.optionList]);

  // Validation for steps
  const stepsValidity = useMemo<StepValidation>(
    () => ({
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
    }),
    [formData, hasCorrectOption]
  );

  // Validation for the entire form
  const validate = useCallback(() => {
    const errors: string[] = [];

    if (!formData.name?.trim()) {
      errors.push("Exercise name is required");
    }
    if (!formData.chapter) {
      errors.push("Chapter is required");
    }
    if (formData.points === undefined || formData.points <= 0) {
      errors.push("Points must be greater than 0");
    }
    if (formData.difficulty === undefined) {
      errors.push("Difficulty is required");
    }
    if (isTipTapContentEmpty(formData.statement || "")) {
      errors.push("Question is required");
    }
    if (!formData.optionList || formData.optionList.length < 2) {
      errors.push("At least two options are required");
    }
    if (formData.optionList?.some((opt) => isTipTapContentEmpty(opt.choice))) {
      errors.push("All options must have content");
    }
    if (!hasCorrectOption) {
      errors.push("At least one option must be marked as correct");
    }

    return errors;
  }, [formData, hasCorrectOption]);

  // Check if the current step is valid
  const isCurrentStepValid = useCallback(() => {
    return stepsValidity[activeStep];
  }, [activeStep, stepsValidity]);

  // Navigation between steps
  const goToNextStep = useCallback(() => {
    if (activeStep < MULTI_CHOICE_STEPS.length - 1) {
      // Mark current step as visited
      setStepsVisited((prev) => ({
        ...prev,
        [activeStep]: true
      }));

      setActiveStep((prev) => prev + 1);
    }
  }, [activeStep]);

  const goToPrevStep = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  }, [activeStep]);

  // Generate HTML preview
  const generateHtmlPreview = useCallback(() => {
    try {
      return generateMultiChoicePreview(
        formData.statement || "",
        (formData.optionList || []) as OptionWithId[],
        formData.name || ""
      );
    } catch (error) {
      console.error("Error generating preview:", error);
      return "<div>Error generating preview</div>";
    }
  }, [formData.statement, formData.optionList]);

  // Handle save
  const handleSave = useCallback(async () => {
    // Validate all fields
    const errors = validate();

    if (errors.length > 0) {
      // Show errors
      errors.forEach((error) => toast.error(error));

      // Mark all steps as visited to show validation errors
      setStepsVisited({
        0: true,
        1: true,
        2: true,
        3: true
      });

      // Set interaction flags to true to show validation errors
      setQuestionInteracted(true);
      setOptionsInteracted(true);
      setSettingsInteracted(true);

      return;
    }

    // Set saving state
    setIsSaving(true);

    try {
      // Generate HTML preview
      const htmlsrc = generateHtmlPreview();

      // Save the exercise
      await onSave({
        ...formData,
        htmlsrc,
        points: formData.points || 1,
        name: formData.name || createExerciseId(),
        chapter: formData.chapter || "",
        question_type: "mchoice",
        difficulty: formData.difficulty || 3
      } as CreateExerciseFormType);
    } catch (error) {
      console.error("Error saving exercise:", error);
      toast.error("Failed to save exercise");
      setIsSaving(false);
    }
  }, [validate, generateHtmlPreview, onSave, formData]);

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <div className={styles.questionContainer}>
            <div className={styles.questionHeader}>
              <h3>Multiple Choice Question</h3>
            </div>

            <div className={styles.questionContent}>
              <div className={styles.questionHelp}>
                <i className="pi pi-info-circle"></i>
                <span>
                  Create a clear question for which students will select the correct answer(s) from
                  the options you'll define in the next step.
                </span>
              </div>

              <div
                className={`${styles.questionEditor} ${
                  (stepsVisited[0] || questionInteracted) &&
                  isTipTapContentEmpty(formData.statement || "")
                    ? styles.emptyEditor
                    : ""
                }`}
              >
                <Editor
                  content={formData.statement || ""}
                  onChange={handleQuestionChange}
                  onFocus={() => setQuestionInteracted(true)}
                />
              </div>
            </div>

            <div className={styles.questionFooter}>
              <div className={styles.questionTips}>
                <i className="pi pi-lightbulb" style={{ marginRight: "4px" }}></i>
                <span>
                  Tip: Be precise and avoid ambiguity in your question to test specific concepts
                </span>
              </div>

              {(stepsVisited[0] || questionInteracted) &&
                isTipTapContentEmpty(formData.statement || "") && (
                  <div className={styles.validationError}>Question is required</div>
                )}
            </div>
          </div>
        );
      case 1:
        const isNotEnoughOptions = (formData.optionList || []).length < 2;
        const notAllWithContent = (formData.optionList || []).some((opt) =>
          isTipTapContentEmpty(opt.choice)
        );
        const isNotValid = isNotEnoughOptions || notAllWithContent || !hasCorrectOption;

        return (
          <div className={styles.optionsSection}>
            <MultiChoiceOptions
              options={(formData.optionList || []) as OptionWithId[]}
              onChange={handleOptionsChange}
              showValidation={stepsVisited[1] || optionsInteracted}
            />
            {(stepsVisited[1] || optionsInteracted) && isNotValid && (
              <div className={styles.validationError}>
                {isNotEnoughOptions && <div>At least two options are required</div>}
                {notAllWithContent && <div>All options must have content</div>}
                {!hasCorrectOption && <div>At least one option must be marked as correct</div>}
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{isEdit ? "Edit Multiple Choice Exercise" : "Create Multiple Choice Exercise"}</h2>
        <div className={styles.headerButtons}>
          <Button label="Cancel" icon="pi pi-times" severity="secondary" onClick={onCancel} />
          {activeStep > 0 && (
            <Button label="Back" icon="pi pi-chevron-left" text onClick={goToPrevStep} />
          )}
          {activeStep === MULTI_CHOICE_STEPS.length - 1 ? (
            <Button
              label="Save"
              icon="pi pi-check"
              onClick={handleSave}
              disabled={Object.values(stepsValidity).some((valid) => !valid) || isSaving}
              loading={isSaving}
            />
          ) : (
            <Button
              label="Next"
              icon="pi pi-chevron-right"
              iconPos="right"
              onClick={goToNextStep}
              disabled={!isCurrentStepValid()}
            />
          )}
        </div>
      </div>

      <div className={styles.content}>
        <Steps
          model={MULTI_CHOICE_STEPS}
          activeIndex={activeStep}
          onSelect={(e) => {
            // Mark the step as visited when directly selected
            setStepsVisited((prev) => ({
              ...prev,
              [activeStep]: true
            }));

            // Only allow moving to accessible steps
            const canAccess =
              e.index === 0 || // Always can go to first step
              e.index < activeStep || // Can go back
              (e.index === activeStep + 1 && isCurrentStepValid()); // Can go forward if current is valid

            if (canAccess) {
              setActiveStep(e.index);
            } else {
              toast.error("Please complete the current step before proceeding");
            }
          }}
          readOnly={false}
          className={styles.steps}
        />

        {renderStepContent()}
      </div>
    </div>
  );
};
