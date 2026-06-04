import { useAssignmentRouting } from "@components/routes/AssignmentBuilder/hooks/useAssignmentRouting";
import { Button, Card, Group, Title } from "@mantine/core";
import { useState, useEffect } from "react";

import { Icon } from "@/components/ui/Icon";
import { CreateExerciseFormType, ExerciseType } from "@/types/exercises";

import { ExerciseFactory } from "./components/ExerciseFactory";
import { ExerciseTypeSelect } from "./components/ExerciseTypeSelect";

interface CreateExerciseProps {
  onCancel: () => void;
  onSave: (exercise: CreateExerciseFormType) => Promise<void>;
  resetForm?: boolean;
  onFormReset?: () => void;
  initialData?: Partial<CreateExerciseFormType>;
  isEdit?: boolean;
}

export const CreateExercise = ({
  onCancel,
  onSave,
  resetForm = false,
  onFormReset,
  initialData,
  isEdit = false
}: CreateExerciseProps) => {
  const { exerciseType, updateExerciseType, updateExerciseViewMode } = useAssignmentRouting();

  // If editing and there's initial data with question_type, use that type
  const [selectedType, setSelectedType] = useState<ExerciseType | null>(
    isEdit && initialData && (initialData.question_type as ExerciseType)
      ? (initialData.question_type as ExerciseType)
      : (exerciseType as ExerciseType | null)
  );

  useEffect(() => {
    if (!isEdit) {
      if (exerciseType) {
        setSelectedType(exerciseType as ExerciseType);
      } else {
        setSelectedType(null);
      }
    }
  }, [exerciseType, isEdit]);

  // Reset the form when resetForm is true
  useEffect(() => {
    if (resetForm && onFormReset) {
      setSelectedType(null);
      onFormReset();
    }
  }, [resetForm, onFormReset]);

  const handleTypeSelect = (type: string) => {
    const exerciseType = type as ExerciseType;

    setSelectedType(exerciseType);
    if (!isEdit) {
      updateExerciseType(type);
    }
  };

  const handleCancel = () => {
    if (isEdit) {
      onCancel();
    } else {
      setSelectedType(null);
      updateExerciseViewMode("create");
    }
  };

  if (!selectedType) {
    return (
      <Card withBorder radius="md" padding="lg">
        <Title order={4} mb="md">
          {isEdit ? "Edit exercise type" : "Select exercise type"}
        </Title>
        <ExerciseTypeSelect selectedType={selectedType} onSelect={handleTypeSelect} />
        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="subtle" leftSection={<Icon name="times" size={16} />} onClick={onCancel}>
            Cancel
          </Button>
        </Group>
      </Card>
    );
  }

  return (
    <ExerciseFactory
      type={selectedType}
      onCancel={handleCancel}
      onSave={onSave}
      resetForm={resetForm}
      onFormReset={onFormReset}
      initialData={initialData}
      isEdit={isEdit}
    />
  );
};
