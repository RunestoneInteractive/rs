import { Badge } from "@mantine/core";
import classNames from "classnames";

import { useExerciseTypes } from "@/hooks/useExerciseTypes";

import styles from "./ExerciseTypeTag.module.css";

interface ExerciseTypeTagProps {
  type: string;
  className?: string;
}

export const ExerciseTypeTag = ({ type, className }: ExerciseTypeTagProps) => {
  const exerciseTypes = useExerciseTypes();
  const typeConfig = exerciseTypes.find((t) => t.value === type);

  if (!typeConfig) {
    return null;
  }

  return (
    <Badge
      className={classNames(styles.tag, className)}
      styles={{
        root: {
          backgroundColor: typeConfig.color.background,
          color: typeConfig.color.text
        }
      }}
    >
      {typeConfig.tag}
    </Badge>
  );
};
