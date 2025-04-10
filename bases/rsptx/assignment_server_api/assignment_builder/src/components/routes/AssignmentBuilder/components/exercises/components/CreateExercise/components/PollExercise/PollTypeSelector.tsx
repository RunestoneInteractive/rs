import styles from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/shared/styles/CreateExercise.module.css";
import { PollType } from "@components/routes/AssignmentBuilder/components/exercises/components/CreateExercise/types/PollTypes";
import { useCallback } from "react";

interface PollTypeSelectorProps {
  value: PollType;
  onChange: (value: PollType) => void;
}

export const PollTypeSelector = ({ value, onChange }: PollTypeSelectorProps) => {
  const handleTypeSelect = useCallback(
    (selectedType: PollType) => {
      onChange(selectedType);
    },
    [onChange]
  );

  return (
    <div className={styles.pollTypeContainer}>
      <div className={styles.pollTypeHeader}>
        <h3>Select Poll Type</h3>
        <p>Choose how students will respond to your question</p>
      </div>

      <div className={styles.pollTypeOptions}>
        <div
          className={`${styles.pollTypeCard} ${value === "scale" ? styles.active : ""}`}
          onClick={() => handleTypeSelect("scale")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleTypeSelect("scale")}
          aria-pressed={value === "scale"}
        >
          <div className={styles.pollTypeIcon}>
            <i className="pi pi-sliders-h"></i>
          </div>
          <div className={styles.pollTypeTitle}>Scale (1 to N)</div>
          <div className={styles.pollTypeDescription}>
            Students rate on a numeric scale from 1 to a maximum value that you define
          </div>
        </div>

        <div
          className={`${styles.pollTypeCard} ${value === "options" ? styles.active : ""}`}
          onClick={() => handleTypeSelect("options")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleTypeSelect("options")}
          aria-pressed={value === "options"}
        >
          <div className={styles.pollTypeIcon}>
            <i className="pi pi-list"></i>
          </div>
          <div className={styles.pollTypeTitle}>Multiple Options</div>
          <div className={styles.pollTypeDescription}>
            Students choose from custom options that you create and order
          </div>
        </div>
      </div>

      <div className={styles.pollTypeHelp}>
        <i className="pi pi-info-circle"></i>
        <span>
          {value === "scale"
            ? "Scale polls are perfect for rating questions or gauging intensity on a numeric scale"
            : "Multiple choice polls are ideal for questions with specific answer choices"}
        </span>
      </div>
    </div>
  );
};
