import React from "react";

import styles from "./styles/CreateExercise.module.css";

interface ValidationMessageProps {
  errors: string[];
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({ errors }) => {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={styles.validationError}>
      {errors.map((error, index) => (
        <div key={index}>{error}</div>
      ))}
    </div>
  );
};
