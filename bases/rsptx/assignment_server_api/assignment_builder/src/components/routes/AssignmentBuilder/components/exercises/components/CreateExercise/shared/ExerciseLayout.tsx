import { Button } from "primereact/button";
import { Steps } from "primereact/steps";
import { ReactNode, useMemo, createContext, useContext } from "react";

import { ExerciseStepWrapper } from "@/components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/shared/ExerciseStepWrapper";

import { getStepConfig } from "../config/stepConfigs";
import { ValidationState } from "../hooks/useStepValidation";

import { ValidationMessage } from "./ValidationMessage";
import styles from "./styles/CreateExercise.module.css";

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
  stepsValidity: Record<number, boolean>;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
  onStepSelect: (index: number) => void;
  children: ReactNode;
  validation?: ValidationState;
}

export const ExerciseLayout = ({
  title,
  exerciseType,
  isEdit,
  steps,
  activeStep,
  isCurrentStepValid,
  isSaving,
  stepsValidity,
  onCancel,
  onBack,
  onNext,
  onSave,
  onStepSelect,
  children,
  validation
}: ExerciseLayoutProps) => {
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

  return (
    <ValidationContext.Provider value={validationContextValue}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>{isEdit ? `Edit ${title}` : `Create ${title}`}</h2>
          <div className={styles.headerButtons}>
            <Button label="Cancel" icon="pi pi-times" severity="secondary" onClick={onCancel} />
            {activeStep > 0 && (
              <Button label="Back" icon="pi pi-chevron-left" text onClick={onBack} />
            )}
            {activeStep === steps.length - 1 ? (
              <Button
                label="Save"
                icon="pi pi-check"
                onClick={onSave}
                disabled={isSaving}
                loading={isSaving}
              />
            ) : (
              <Button label="Next" icon="pi pi-chevron-right" iconPos="right" onClick={onNext} />
            )}
          </div>
        </div>

        <div className={styles.content}>
          <Steps
            model={steps}
            activeIndex={activeStep}
            onSelect={(e) => onStepSelect(e.index)}
            readOnly={false}
            className={styles.steps}
          />

          <div className={styles.exerciseContentWrapper}>
            {currentStepConfig ? (
              <ExerciseStepWrapper
                title={currentStepConfig.title}
                description={currentStepConfig.description}
              >
                {children}
              </ExerciseStepWrapper>
            ) : (
              <>{children}</>
            )}
          </div>
          {validation && !validation.isValid && <ValidationMessage errors={validation.errors} />}
        </div>
      </div>
    </ValidationContext.Provider>
  );
};
