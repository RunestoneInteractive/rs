import { Icon } from "@components/ui/Icon";
import { Button } from "@mantine/core";
import { FC } from "react";

import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export const ErrorState: FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message = "Refresh the page. If it keeps happening, contact support.",
  retryLabel = "Refresh page",
  onRetry = () => window.location.reload()
}) => {
  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorContent} role="alert">
        <div className={styles.errorIcon}>
          <Icon name="exclamation-triangle" size={26} />
        </div>
        <h2 className={styles.errorTitle}>{title}</h2>
        <p className={styles.errorMessage}>{message}</p>
        <div className={styles.errorActions}>
          <Button variant="default" leftSection={<Icon name="refresh" />} onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
