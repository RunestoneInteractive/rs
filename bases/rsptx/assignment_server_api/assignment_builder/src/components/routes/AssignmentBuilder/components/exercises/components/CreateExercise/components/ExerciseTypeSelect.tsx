import { ExerciseTypeTag } from "@components/ui/ExerciseTypeTag";
import { Card } from "primereact/card";

import { useExerciseTypes } from "@/hooks/useExerciseTypes";

import styles from "../CreateExercise.module.css";

interface ExerciseTypeSelectProps {
  selectedType: string | null;
  onSelect: (type: string) => void;
}

export const ExerciseTypeSelect = ({ selectedType, onSelect }: ExerciseTypeSelectProps) => {
  const exerciseTypes = useExerciseTypes();

  return (
    <div className="grid">
      {exerciseTypes
        .filter((type) => !!type.description)
        .map((type) => (
          <div key={type.value} className="col-12 sm:col-6 lg:col-3">
            <Card
              className={`${styles.typeCard} ${selectedType === type.value ? styles.selected : ""} cursor-pointer`}
              onClick={() => onSelect(type.value)}
            >
              <div className="flex flex-column gap-1">
                <div className="flex align-items-center gap-2">
                  <ExerciseTypeTag type={type.value} />
                  <span className="font-medium text-sm">{type.label}</span>
                </div>
                <p className="text-xs text-500 m-0 line-height-2">{type.description}</p>
              </div>
            </Card>
          </div>
        ))}
    </div>
  );
};
