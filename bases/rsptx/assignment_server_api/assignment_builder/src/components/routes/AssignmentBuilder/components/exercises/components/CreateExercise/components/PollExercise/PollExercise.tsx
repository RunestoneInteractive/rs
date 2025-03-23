import { SCALE_CONFIG } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/constants";
import { BaseExerciseProps } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/ExerciseTypes";
import { PollType } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/PollTypes";
import { Editor } from "@components/routes/AssignmentBuilder/components/exercises/components/TipTap/Editor";
import { Button } from "primereact/button";
import { Steps } from "primereact/steps";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { CreateExerciseFormType, Option } from "@/types/exercises";
import { createExerciseId } from "@/utils/exercise";
import { generatePollPreview } from "@/utils/preview/poll";

/* eslint-disable-next-line */
import styles from "../../shared/styles/CreateExercise.module.css";

import { PollExerciseSettings } from "./PollExerciseSettings";
import { PollOptions, isTipTapContentEmpty } from "./PollOptions";
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
  question_type: "poll",
  statement: "",
  optionList: [
    { id: `option-${Date.now()}`, choice: "" } as PollOption,
    { id: `option-${Date.now() + 1}`, choice: "" } as PollOption
  ]
});

export const PollExercise: FC<BaseExerciseProps> = ({
  initialData,
  onSave,
  onCancel,
  resetForm,
  onFormReset,
  isEdit = false
}) => {
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
              id: (option as PollOption).id || `option-${Date.now()}-${index}`
            })) as PollOption[])
          : getDefaultFormData().optionList
      };
    }
    return getDefaultFormData();
  });

  // UI state for the wizard
  const [activeStep, setActiveStep] = useState(0);
  const [pollType, setPollType] = useState<PollType>(() => {
    // If editing, check if it's a scale type (all options are numbers)
    if (isEdit && Array.isArray(formData.optionList) && formData.optionList.length > 0) {
      const allNumbers = formData.optionList.every((opt) => !isNaN(Number(opt.choice)));

      return allNumbers ? "scale" : "options";
    }
    return "options";
  });
  const [scaleMax, setScaleMax] = useState<number>(() => {
    // If it's a scale, set the max to the number of options or the default
    if (pollType === "scale" && Array.isArray(formData.optionList)) {
      return Math.max(formData.optionList.length || 0, SCALE_CONFIG.MIN);
    }
    return SCALE_CONFIG.DEFAULT;
  });
  const [isSaving, setIsSaving] = useState(false);

  // Track which steps have been visited or attempted
  const [stepsVisited, setStepsVisited] = useState<StepValidation>({
    0: false,
    1: false,
    2: false,
    3: false,
    4: false
  });

  // Track if fields have been interacted with (for showing validation)
  const [questionInteracted, setQuestionInteracted] = useState(false);
  const [optionsInteracted, setOptionsInteracted] = useState(false);
  const [settingsInteracted, setSettingsInteracted] = useState(false);

  // Reset form when resetForm is true
  useEffect(() => {
    if (resetForm && onFormReset) {
      setFormData(getDefaultFormData());
      setPollType("options");
      setScaleMax(SCALE_CONFIG.DEFAULT);
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
        3: false,
        4: false
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

  // Handle poll type change
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

  // Handle scale max change
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

  // Handle options change
  const handleOptionsChange = useCallback(
    (options: PollOption[]) => {
      updateFormData("optionList", options);
      setOptionsInteracted(true);
    },
    [updateFormData]
  );

  // Validation for steps
  const stepsValidity = useMemo<StepValidation>(
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
    if (pollType === "options" && (!formData.optionList || formData.optionList.length < 2)) {
      errors.push("At least two options are required");
    }
    if (
      pollType === "options" &&
      formData.optionList?.some((opt) => isTipTapContentEmpty(opt.choice))
    ) {
      errors.push("All options must have content");
    }
    if (pollType === "scale" && (scaleMax < SCALE_CONFIG.MIN || scaleMax > SCALE_CONFIG.MAX)) {
      errors.push(`Scale maximum must be between ${SCALE_CONFIG.MIN} and ${SCALE_CONFIG.MAX}`);
    }

    return errors;
  }, [formData, pollType, scaleMax]);

  // Check if the current step is valid
  const isCurrentStepValid = useCallback(() => {
    return stepsValidity[activeStep];
  }, [activeStep, stepsValidity]);

  // Navigation between steps
  const goToNextStep = useCallback(() => {
    if (activeStep < POLL_STEPS.length - 1) {
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
      const optionStrings = (formData.optionList || []).map((opt) => opt.choice);

      return generatePollPreview(
        formData.statement || "",
        optionStrings,
        formData.name ?? "",
        pollType
      );
    } catch (error) {
      console.error("Error generating preview:", error);
      return "<div>Error generating preview</div>";
    }
  }, [formData.optionList, formData.statement, formData.name, pollType]);

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
        3: true,
        4: true
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
        question_type: "poll",
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
              <h3>Poll Question</h3>
            </div>

            <div className={styles.questionContent}>
              <div className={styles.questionHelp}>
                <i className="pi pi-info-circle"></i>
                <span>
                  Create a clear question that students will respond to with the poll options you'll
                  define later.
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
                <span>Tip: Be concise and specific with your question for better responses</span>
              </div>

              {(stepsVisited[0] || questionInteracted) &&
                isTipTapContentEmpty(formData.statement || "") && (
                  <div className={styles.validationError}>Question is required</div>
                )}
            </div>
          </div>
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
              showValidation={stepsVisited[2] || optionsInteracted}
            />
            {(stepsVisited[2] || optionsInteracted) &&
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{isEdit ? "Edit Poll Exercise" : "Create Poll Exercise"}</h2>
        <div className={styles.headerButtons}>
          <Button label="Cancel" icon="pi pi-times" severity="secondary" onClick={onCancel} />
          {activeStep > 0 && (
            <Button label="Back" icon="pi pi-chevron-left" text onClick={goToPrevStep} />
          )}
          {activeStep === POLL_STEPS.length - 1 ? (
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
          model={POLL_STEPS}
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
