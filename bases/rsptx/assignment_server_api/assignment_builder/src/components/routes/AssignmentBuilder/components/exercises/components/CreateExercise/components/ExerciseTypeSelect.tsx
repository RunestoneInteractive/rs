import { Stack, Text, UnstyledButton } from "@mantine/core";
import { CSSProperties } from "react";

import { Icon } from "@/components/ui/Icon";
import {
  ExerciseFamily,
  exerciseFamilies,
  getExerciseColorScheme,
  getExerciseFamily,
  getExerciseTypeIcon
} from "@/config/exerciseTypes";
import { useExerciseTypes } from "@/hooks/useExerciseTypes";

import styles from "./ExerciseTypeSelect.module.css";

interface ExerciseTypeSelectProps {
  selectedType: string | null;
  onSelect: (type: string) => void;
}

const familyOrder = Object.keys(exerciseFamilies) as ExerciseFamily[];

export const ExerciseTypeSelect = ({ selectedType, onSelect }: ExerciseTypeSelectProps) => {
  const exerciseTypes = useExerciseTypes().filter((type) => !!type.description);

  const groups = familyOrder
    .map((family) => ({
      family,
      label: exerciseFamilies[family].label,
      types: exerciseTypes.filter((type) => getExerciseFamily(type.value) === family)
    }))
    .filter((group) => group.types.length > 0);

  return (
    <Stack gap="lg">
      {groups.map((group) => (
        <div key={group.family} className={styles.familyGroup} data-family={group.family}>
          <Text component="span" className={styles.familyLabel}>
            {group.label}
          </Text>
          <div className={styles.grid}>
            {group.types.map((type) => {
              const scheme = getExerciseColorScheme(type.value);
              const isSelected = selectedType === type.value;

              return (
                <UnstyledButton
                  key={type.value}
                  className={styles.typeCard}
                  data-selected={isSelected || undefined}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(type.value)}
                  style={
                    {
                      "--extype-hue": scheme.hue,
                      "--extype-text": scheme.text
                    } as CSSProperties
                  }
                >
                  <span className={styles.iconTile}>
                    <Icon name={getExerciseTypeIcon(type.value)} size={20} />
                  </span>
                  <span className={styles.cardBody}>
                    <span className={styles.cardName}>{type.label}</span>
                    <span className={styles.cardDescription}>{type.description}</span>
                  </span>
                  {isSelected && (
                    <span className={styles.checkBadge} data-check-badge>
                      <Icon name="check" size={12} />
                    </span>
                  )}
                </UnstyledButton>
              );
            })}
          </div>
        </div>
      ))}
    </Stack>
  );
};
