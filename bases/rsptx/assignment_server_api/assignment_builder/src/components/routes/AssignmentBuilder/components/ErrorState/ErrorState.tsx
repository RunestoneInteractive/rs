import { Button } from "primereact/button";
import { FC } from "react";

import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  title?: string;
  message?: string;
}

export const ErrorState: FC<ErrorStateProps> = ({
  title = "Oops! Something went wrong",
  message = "We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists."
}) => {
  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>
          <i className="pi pi-exclamation-triangle"></i>
        </div>
        <h2 className={styles.errorTitle}>{title}</h2>
        <p className={styles.errorMessage}>{message}</p>
        <div className={styles.errorActions}>
          <Button
            icon="pi pi-refresh"
            label="Refresh Page"
            onClick={() => window.location.reload()}
            severity="success"
            className={styles.retryButton}
          />
        </div>
      </div>
    </div>
  );
};
