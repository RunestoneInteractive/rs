import { Button } from "primereact/button";
import { Steps } from "primereact/steps";
import { ReactNode } from "react";

import styles from "./styles/CreateExercise.module.css";

interface ExerciseLayoutProps {
  title: string;
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
}

export const ExerciseLayout = ({
  title,
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
  children
}: ExerciseLayoutProps) => {
  return (
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
              disabled={Object.values(stepsValidity).some((valid) => !valid) || isSaving}
              loading={isSaving}
            />
          ) : (
            <Button
              label="Next"
              icon="pi pi-chevron-right"
              iconPos="right"
              onClick={onNext}
              disabled={!isCurrentStepValid()}
            />
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

        {children}
      </div>
    </div>
  );
};
