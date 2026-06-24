import { Button, Stepper, Text, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { ReactNode, useMemo, createContext, useContext, useRef } from "react";

import { ExerciseStepWrapper } from "@/components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/shared/ExerciseStepWrapper";
import { ExerciseTypeTag } from "@/components/ui/ExerciseTypeTag";
import { Icon } from "@/components/ui/Icon";
import { useFullscreen } from "@/hooks/useFullscreen";

import { getStepConfig } from "../config/stepConfigs";
import { ValidationState } from "../hooks/useStepValidation";

import styles from "./ExerciseLayout.module.css";
import { ValidationMessage } from "./ValidationMessage";

interface ValidationContextType {
  shouldShowValidation: boolean;
}

const ValidationContext = createContext<ValidationContextType>({
  shouldShowValidation: false
});

export const useValidation = () => useContext(ValidationContext);

interface ExerciseLayoutProps {
  title: string;
  exerciseType: string;
  isEdit: boolean;
  steps: { label: string }[];
  activeStep: number;
  isCurrentStepValid: () => boolean;
  isSaving: boolean;
  isDirty?: boolean;
  stepsValidity: Record<number, boolean>;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
  onStepSelect: (index: number) => void;
  children: ReactNode;
  validation?: ValidationState;
  headerExtra?: ReactNode;
}

export const ExerciseLayout = ({
  title,
  exerciseType,
  isEdit,
  steps,
  activeStep,
  isSaving,
  isDirty = false,
  onCancel,
  onBack,
  onNext,
  onSave,
  onStepSelect,
  children,
  validation,
  headerExtra
}: ExerciseLayoutProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen, exitFullscreen, isSupported } =
    useFullscreen(containerRef);

  const currentStepConfig = useMemo(
    () => getStepConfig(exerciseType, activeStep),
    [exerciseType, activeStep]
  );

  const validationContextValue = useMemo(
    () => ({
      shouldShowValidation: validation?.isValid === false
    }),
    [validation]
  );

  const blockedReasons = validation && !validation.isValid ? validation.errors : [];
  const isBlocked = blockedReasons.length > 0;

  const handleCancel = () => {
    if (isFullscreen) {
      exitFullscreen();
    }
    if (!isDirty) {
      onCancel();
      return;
    }
    modals.openConfirmModal({
      title: "Discard changes?",
      children: <Text size="sm">Your unsaved changes to this exercise will be lost.</Text>,
      labels: { confirm: "Discard", cancel: "Keep editing" },
      confirmProps: { color: "red" },
      onConfirm: onCancel
    });
  };

  const handleSave = () => {
    if (isFullscreen) {
      exitFullscreen();
    }
    onSave();
  };

  const primaryAction =
    activeStep === steps.length - 1 ? (
      <Button
        leftSection={<Icon name="save" size={14} />}
        onClick={handleSave}
        disabled={isSaving || isBlocked}
        loading={isSaving}
      >
        Save
      </Button>
    ) : (
      <Button
        rightSection={<Icon name="chevron-right" size={14} />}
        onClick={onNext}
        disabled={isBlocked}
      >
        Next
      </Button>
    );

  return (
    <ValidationContext.Provider value={validationContextValue}>
      <div id="exercise-layout" className={styles.root} ref={containerRef}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? `Edit ${title}` : `Create ${title}`}</h2>
          <ExerciseTypeTag type={exerciseType} />
          {headerExtra}
          <div className={styles.headerButtons}>
            {isSupported && (
              <Tooltip
                label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                position="bottom"
              >
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={toggleFullscreen}
                  data-tour="fullscreen-btn"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  <Icon name={isFullscreen ? "window-minimize" : "window-maximize"} />
                </Button>
              </Tooltip>
            )}
            <Button
              variant="default"
              leftSection={<Icon name="times" size={14} />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
            {activeStep > 0 && (
              <Button
                variant="subtle"
                leftSection={<Icon name="chevron-left" size={14} />}
                onClick={onBack}
              >
                Back
              </Button>
            )}
            <Tooltip
              label={blockedReasons.join(" · ")}
              disabled={!isBlocked}
              position="bottom"
              multiline
              maw={320}
            >
              <span className={styles.nextWrap} data-blocked={isBlocked || undefined}>
                {primaryAction}
              </span>
            </Tooltip>
          </div>
        </div>

        <div className={styles.stepperBar}>
          <Stepper
            active={activeStep}
            onStepClick={onStepSelect}
            size="xs"
            wrap={false}
            className={styles.stepper}
          >
            {steps.map((step, index) => (
              <Stepper.Step key={index} label={step.label} aria-label={step.label} />
            ))}
          </Stepper>
        </div>

        <div className={styles.body}>
          {currentStepConfig ? (
            <ExerciseStepWrapper
              title={currentStepConfig.title}
              description={currentStepConfig.description}
            >
              {children}
            </ExerciseStepWrapper>
          ) : (
            <div className={styles.plainContent}>{children}</div>
          )}
        </div>
        {validation && !validation.isValid && <ValidationMessage errors={validation.errors} />}
      </div>
    </ValidationContext.Provider>
  );
};
