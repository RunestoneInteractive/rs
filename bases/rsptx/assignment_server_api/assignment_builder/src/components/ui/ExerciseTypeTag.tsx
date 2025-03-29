import { Chip } from "primereact/chip";

import { useExerciseTypes } from "@/hooks/useExerciseTypes";

interface ExerciseTypeTagProps {
  type: string;
  className?: string;
}

export const ExerciseTypeTag = ({ type, className }: ExerciseTypeTagProps) => {
  const exerciseTypes = useExerciseTypes();
  const typeConfig = exerciseTypes.find((t) => t.value === type);

  return (
    !!typeConfig && (
      <Chip
        label={typeConfig.tag}
        className={className}
        style={{
          backgroundColor: typeConfig.color.background,
          color: typeConfig.color.text,
          borderRadius: "8px",
          padding: "0 6px",
          fontSize: "0.625rem",
          fontWeight: 600,
          textTransform: "uppercase",
          height: "16px",
          lineHeight: "16px"
        }}
      />
    )
  );
};
