import React from "react";

import { Icon } from "@/components/ui/Icon";

import styles from "./ValidationMessage.module.css";

interface ValidationMessageProps {
  errors: string[];
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({ errors }) => {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={styles.bar} role="alert">
      <span className={styles.icon}>
        <Icon name="exclamation-triangle" size={16} />
      </span>
      <ul className={styles.list}>
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    </div>
  );
};
