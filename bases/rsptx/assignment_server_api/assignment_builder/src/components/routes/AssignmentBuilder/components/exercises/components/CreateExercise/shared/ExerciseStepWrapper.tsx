import { Button } from "primereact/button";
import { ReactNode, FC } from "react";

import styles from "./styles/ExerciseStepWrapper.module.css";

interface ExerciseStepWrapperProps {
  title: string;
  description: string;
  children: ReactNode;
}

export const ExerciseStepWrapper: FC<ExerciseStepWrapperProps> = ({
  title,
  description,
  children
}) => {
  return (
    <div className={styles.stepContainer}>
      <div className={styles.stepCard}>
        <div className={styles.stepHeader}>
          <div className="flex align-items-center gap-1">
            <h3>{title}</h3>
            <Button
              icon="pi pi-info-circle"
              rounded
              text
              severity="info"
              tooltip={description}
              tooltipOptions={{ position: "right", showDelay: 150, style: { maxWidth: "300px" } }}
              style={{ width: "24px", height: "24px", padding: 0 }}
            />
          </div>
        </div>

        <div className={styles.stepContent}>
          <div className={styles.contentSection}>{children}</div>
        </div>
      </div>
    </div>
  );
};
