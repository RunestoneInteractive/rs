import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { ReactNode, FC } from "react";

import { Icon } from "@/components/ui/Icon";

import styles from "./styles/ExerciseStepWrapper.module.css";

const INFO_TRIGGER_SIZE = 40;

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
          <Group align="center" gap={4}>
            <h3>{title}</h3>
            <Tooltip
              label={description}
              position="right"
              openDelay={150}
              multiline
              w={300}
              events={{ hover: true, focus: true, touch: true }}
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                size={INFO_TRIGGER_SIZE}
                className={styles.infoIcon}
                aria-label="About this step"
              >
                <Icon name="info-circle" />
              </ActionIcon>
            </Tooltip>
          </Group>
        </div>

        <div className={styles.stepContent}>
          <div className={styles.contentSection}>{children}</div>
        </div>
      </div>
    </div>
  );
};
